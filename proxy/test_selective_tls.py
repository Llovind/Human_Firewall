"""Isolated protocol check: no real website, browser, or system proxy changes.

Run inside the proxy image with this directory mounted at /checks and three
synthetic .test hostnames mapped to 127.0.0.1 (see demo runbook).
"""
import hashlib
import http.client
import json
import os
import socket
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BLOCKED = set()
SEEN = []
DECISIONS = []


class Policy(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path.endswith("enforcement/check"):
            data = {"actions": {d: "block" if d in BLOCKED else "allow" for d in body["domains"]}}
        else:
            from urllib.parse import urlsplit
            target = body["target"]
            domain = urlsplit(target if "://" in target else "//" + target).hostname
            DECISIONS.append(body)
            if domain == "slow.afferent.test":
                time.sleep(0.25)  # mimic pending ML before a malicious verdict
            data = {"domain": domain, "action": "block" if domain in BLOCKED else "allow", "reason": "Isolated policy fixture"}
        payload = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class Origin(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def do_GET(self):
        SEEN.append(self.headers.get("Host"))
        payload = b"ISOLATED ORIGIN"
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class SelectiveTLSChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        root.chmod(0o755)
        # Disposable certificates, generated only inside this test container.
        for name, subject, san in (
            ("proxy", "/CN=Isolated Test Proxy CA", None),
            ("origin", "/CN=allowed.afferent.test", "DNS:allowed.afferent.test,DNS:blocked.afferent.test,DNS:slow.afferent.test"),
        ):
            args = ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", subject,
                    "-keyout", str(root / f"{name}.key"), "-out", str(root / f"{name}.crt")]
            if san:
                args += ["-addext", "subjectAltName=" + san]
            subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        config = Path("/etc/squid/squid.conf").read_text()
        config = config.replace("/etc/squid/ssl_cert/afferent-proxy-ca.crt", str(root / "proxy.crt"))
        config = config.replace("/etc/squid/ssl_cert/afferent-proxy-ca.key", str(root / "proxy.key"))
        # This replacement is a disposable container fixture, not repo config.
        Path("/etc/squid/squid.conf").write_text(config)
        cls.policy = ThreadingHTTPServer(("127.0.0.1", 8085), Policy)
        cls.origin = ThreadingHTTPServer(("127.0.0.1", 443), Origin)
        origin_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        origin_tls.load_cert_chain(root / "origin.crt", root / "origin.key")
        cls.origin.socket = origin_tls.wrap_socket(cls.origin.socket, server_side=True)
        for server in (cls.policy, cls.origin):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        cls.client_tls = ssl.create_default_context(cafile=str(root / "origin.crt"))
        cls.client_tls.load_verify_locations(cafile=str(root / "proxy.crt"))
        origin_der = ssl.PEM_cert_to_DER_cert((root / "origin.crt").read_text())
        cls.origin_fingerprint = hashlib.sha256(origin_der).hexdigest()
        env = {**os.environ, "SERVICE_API_KEY": "isolated-fixture-key",
               "PROXY_DECISION_API_URL": "http://127.0.0.1:8085/api/proxy/decision",
               "PROXY_ENFORCEMENT_API_URL": "http://127.0.0.1:8085/api/proxy/enforcement/check",
               "PROXY_FAIL_MODE": "closed", "PROXY_REVOCATION_INTERVAL_SECONDS": "0.1"}
        cls.log = open(root / "proxy.log", "w+")
        cls.process = subprocess.Popen(["python3", "/usr/local/bin/tunnel_control.py"], env=env, stdout=cls.log, stderr=cls.log)
        for _ in range(100):
            if cls.process.poll() is not None:
                cls.log.seek(0)
                raise RuntimeError(cls.log.read())
            try:
                with socket.create_connection(("127.0.0.1", 3129), timeout=0.1):
                    return
            except OSError:
                time.sleep(0.05)
        raise RuntimeError("Squid did not start")

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=15)
        cls.log.close()
        for server in (cls.policy, cls.origin):
            server.shutdown()
            server.server_close()
        cls.tmp.cleanup()

    def tunnel(self, host):
        sock = socket.create_connection(("127.0.0.1", 3128), timeout=5)
        sock.sendall(f"CONNECT {host}:443 HTTP/1.1\r\nHost: {host}:443\r\n\r\n".encode())
        headers = b""
        while not headers.endswith(b"\r\n\r\n"):
            data = sock.recv(1)
            if not data or len(headers) > 8192:
                self.fail("CONNECT failed before TLS")
            headers += data
        self.assertIn(b"200", headers.split(b"\r\n", 1)[0])
        return self.client_tls.wrap_socket(sock, server_hostname=host)

    def get(self, sock, host):
        sock.sendall(f"GET /fixture HTTP/1.1\r\nHost: {host}\r\n\r\n".encode())
        response = http.client.HTTPResponse(sock)
        response.begin()
        status, body = response.status, response.read()
        response.close()
        return status, body

    def test_01_allowed_certificate_is_original_not_proxy(self):
        with self.tunnel("allowed.afferent.test") as sock:
            self.assertEqual(hashlib.sha256(sock.getpeercert(binary_form=True)).hexdigest(), self.origin_fingerprint)
            self.assertEqual(self.get(sock, "allowed.afferent.test"), (200, b"ISOLATED ORIGIN"))
        self.assertTrue(any(item["clientIp"] == "127.0.0.1" for item in DECISIONS))

    def test_02_first_malicious_request_never_reaches_origin(self):
        BLOCKED.add("slow.afferent.test")
        before = SEEN.count("slow.afferent.test")
        started = time.monotonic()
        with self.tunnel("slow.afferent.test") as sock:
            status, body = self.get(sock, "slow.afferent.test")
            self.assertEqual(status, 403)
            self.assertIn(b"BLOCKED BY AFFERENT", body)
            self.assertIn(b"width:min(1120px,100%)", body)
            self.assertNotEqual(hashlib.sha256(sock.getpeercert(binary_form=True)).hexdigest(), self.origin_fingerprint)
        self.assertGreaterEqual(time.monotonic() - started, 0.25)
        self.assertEqual(SEEN.count("slow.afferent.test"), before)

    def test_03_revoke_existing_tunnel_not_other_domain_on_same_ip(self):
        BLOCKED.discard("blocked.afferent.test")
        with self.tunnel("blocked.afferent.test") as denied, self.tunnel("allowed.afferent.test") as healthy:
            self.assertEqual(self.get(denied, "blocked.afferent.test")[0], 200)
            self.assertEqual(self.get(healthy, "allowed.afferent.test")[0], 200)
            BLOCKED.add("blocked.afferent.test")
            started = time.monotonic()
            denied.settimeout(3)
            try:
                self.assertEqual(denied.recv(1), b"")
            except (ssl.SSLEOFError, ConnectionResetError):
                pass
            self.assertLess(time.monotonic() - started, 3)
            self.assertEqual(self.get(healthy, "allowed.afferent.test")[0], 200)
        with self.tunnel("blocked.afferent.test") as sock:
            self.assertIn(b"BLOCKED BY AFFERENT", self.get(sock, "blocked.afferent.test")[1])

    def test_04_reserved_probe_is_unchanged(self):
        with socket.create_connection(("127.0.0.1", 3128), timeout=5) as sock:
            sock.sendall(b"GET http://proxy-check.afferent.invalid/__afferent_probe__ HTTP/1.1\r\nHost: proxy-check.afferent.invalid\r\nConnection: close\r\n\r\n")
            response = http.client.HTTPResponse(sock)
            response.begin()
            body = response.read()
            self.assertIn(b"AFFERENT_PROXY_CONNECTED", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)
