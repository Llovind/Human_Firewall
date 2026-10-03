"""Opaque TCP relay in front of Squid, with per-domain active tunnel revocation.

The relay owns its sockets, so revocation works on Docker Desktop without
NET_ADMIN/SOCK_DESTROY. It never decodes TLS: only the plaintext CONNECT line
is read. Squid remains the HTTP proxy, TLS denial-page server, and ML gate.
"""
import asyncio
import ipaddress
import json
import os
import pwd
import signal
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlsplit

HEARTBEAT = Path("/run/afferent/controller-heartbeat")
ALLOW_SOCKET = HEARTBEAT.parent / "allow.sock"


def connect_domain(line: bytes) -> str | None:
    parts = line.decode("ascii").strip().split()
    if len(parts) != 3 or parts[0] != "CONNECT":
        return None
    parsed = urlsplit("//" + parts[1])
    if parsed.username or parsed.password or not parsed.hostname or parsed.port != 443:
        raise ValueError("Invalid CONNECT authority")
    domain = parsed.hostname.rstrip(".").lower().encode("idna").decode()
    if not domain or len(domain) > 253:
        raise ValueError("Invalid CONNECT domain")
    return domain


def proxy_header(peer, local) -> bytes:
    # Only this loopback relay is trusted by Squid's PROXY protocol ACL.
    src, sport = peer[:2]
    dst, dport = local[:2]
    src_ip, dst_ip = ipaddress.ip_address(src), ipaddress.ip_address(dst)
    if src_ip.version != dst_ip.version:
        raise ValueError("Inconsistent proxy socket address families")
    family = "TCP4" if src_ip.version == 4 else "TCP6"
    return f"PROXY {family} {src_ip} {dst_ip} {int(sport)} {int(dport)}\r\n".encode("ascii")


def enforcement_actions(domains):
    from afferent_acl_helper import SERVICE_KEY
    endpoint = os.environ.get("PROXY_ENFORCEMENT_API_URL", "http://flask_api:5000/api/proxy/enforcement/check")
    request = urllib.request.Request(endpoint, data=json.dumps({"domains": domains}).encode(),
        headers={"Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=2) as response:
        actions = json.load(response).get("actions")
    if not isinstance(actions, dict) or any(actions.get(d) not in {"allow", "block"} for d in domains):
        raise ValueError("Incomplete or invalid enforcement response")
    return actions


class Relay:
    def __init__(self):
        self.sessions = {}
        self.limit = int(os.environ.get("PROXY_MAX_CONNECTIONS", "1000"))
        if not 1 <= self.limit <= 10000:
            raise ValueError("PROXY_MAX_CONNECTIONS must be 1..10000")

    async def handle(self, reader, client):
        session_id = uuid.uuid4().hex
        upstream = None
        pumps = []
        if len(self.sessions) >= self.limit:
            client.close()
            return
        # Reserve capacity before awaiting bytes, including slow/incomplete clients.
        self.sessions[session_id] = (None, client, None, False, time.monotonic())
        try:
            first_line = await asyncio.wait_for(reader.readuntil(b"\r\n"), timeout=5)
            if len(first_line) > 4096:
                raise ValueError("Proxy request line too long")
            domain = connect_domain(first_line)
            remote_reader, upstream = await asyncio.open_connection("127.0.0.1", 3129)
            upstream.write(proxy_header(client.get_extra_info("peername"), client.get_extra_info("sockname")))
            upstream.write(first_line)
            await upstream.drain()
            self.sessions[session_id] = (domain, client, upstream, False, self.sessions[session_id][4])

            async def pump(source, destination):
                while data := await source.read(65536):
                    destination.write(data)
                    await destination.drain()

            pumps = [asyncio.create_task(pump(reader, upstream)),
                     asyncio.create_task(pump(remote_reader, client))]
            done, _ = await asyncio.wait(pumps, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except (OSError, ValueError, UnicodeError, asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError):
            pass  # connection failure; never log credentials or raw request lines
        finally:
            self.sessions.pop(session_id, None)
            for task in pumps:
                task.cancel()
            if pumps:
                await asyncio.gather(*pumps, return_exceptions=True)
            for writer in (client, upstream):
                if writer:
                    writer.close()
                    try:
                        await writer.wait_closed()
                    except OSError:
                        pass

    async def mark_allowed(self, reader, writer):
        """Only the internal ACL helper may arm a confirmed spliced tunnel.

        A denied handshake must remain open long enough to serve its local
        page. Query start time prevents a delayed ACK arming a reused tuple.
        """
        try:
            body = json.loads(await asyncio.wait_for(reader.readline(), timeout=1))
            peer = (str(ipaddress.ip_address(body["clientIp"])), int(body["clientPort"]))
            started = float(body["started"])
            for key, value in list(self.sessions.items()):
                address = value[1].get_extra_info("peername")
                if not address:
                    continue
                current = (str(ipaddress.ip_address(address[0])), address[1])
                if current == peer and value[0] == body["domain"] and value[4] <= started:
                    self.sessions[key] = (*value[:3], True, value[4])
                    writer.write(b"OK\n")
                    await writer.drain()
                    break
            else:
                writer.write(b"ERR\n")
                await writer.drain()
        except (OSError, ValueError, KeyError, TypeError, asyncio.TimeoutError):
            pass
        finally:
            writer.close()

    def revoke(self, snapshot, actions):
        closed = 0
        for session_id, domain in snapshot:
            session = self.sessions.get(session_id)
            if not session or session[0] != domain or actions.get(domain) != "block":
                continue
            # Operate on the original live objects, not recycled IP/port tuples.
            # Already-rendered/buffered content cannot be withdrawn.
            for writer in session[1:3]:
                if writer:
                    writer.transport.abort()
            closed += 1
        return closed

    async def reconcile(self, stop):
        interval = float(os.environ.get("PROXY_REVOCATION_INTERVAL_SECONDS", "0.5"))
        if not 0.1 <= interval <= 10:
            raise ValueError("PROXY_REVOCATION_INTERVAL_SECONDS must be 0.1..10")
        last_error_log = 0.0
        while not stop.is_set():
            try:
                snapshot = [(key, value[0]) for key, value in self.sessions.items() if value[0] and value[3]]
                domains = sorted({domain for _, domain in snapshot})
                actions = {}
                for offset in range(0, len(domains), 200):
                    actions.update(await asyncio.to_thread(enforcement_actions, domains[offset:offset + 200]))
                closed = self.revoke(snapshot, actions)
                if closed:
                    print(f"AFFERENT revoked {closed} blocked tunnel(s)", flush=True)
                HEARTBEAT.touch()
            except Exception as exc:
                if time.monotonic() - last_error_log >= 15:
                    print(f"AFFERENT tunnel controller degraded: {type(exc).__name__}", file=sys.stderr, flush=True)
                    last_error_log = time.monotonic()
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass


async def main():
    from render_error_page import main as render_error_page
    render_error_page()
    proxy_user = pwd.getpwnam("proxy")
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    os.chown(HEARTBEAT.parent, 0, proxy_user.pw_gid)
    os.chmod(HEARTBEAT.parent, 0o750)
    ALLOW_SOCKET.unlink(missing_ok=True)
    Path("/run/squid.pid").unlink(missing_ok=True)
    squid = await asyncio.create_subprocess_exec("squid", "-NYCd", "1")
    relay = Relay()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    server = await asyncio.start_server(relay.handle,
        os.environ.get("PROXY_RELAY_BIND_HOST", "0.0.0.0"), 3128, limit=8192)
    registrations = await asyncio.start_unix_server(relay.mark_allowed, str(ALLOW_SOCKET), limit=2048)
    os.chown(ALLOW_SOCKET, 0, proxy_user.pw_gid)
    os.chmod(ALLOW_SOCKET, 0o660)
    controller = asyncio.create_task(relay.reconcile(stop))
    waiter = asyncio.create_task(squid.wait())
    stopper = asyncio.create_task(stop.wait())
    try:
        async with server, registrations:
            await asyncio.wait([waiter, stopper, controller], return_when=asyncio.FIRST_COMPLETED)
            if controller.done():
                controller.result()
    finally:
        stop.set()
        controller.cancel()
        stopper.cancel()
        for session in list(relay.sessions.values()):
            for writer in session[1:3]:
                if writer:
                    writer.transport.abort()
        if squid.returncode is None:
            squid.terminate()
        try:
            await asyncio.wait_for(squid.wait(), timeout=5)
        except asyncio.TimeoutError:
            squid.kill()
            await squid.wait()
        await asyncio.gather(controller, stopper, waiter, return_exceptions=True)
    return squid.returncode


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
