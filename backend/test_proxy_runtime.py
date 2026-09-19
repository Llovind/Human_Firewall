"""Runtime integration checks for PostgreSQL + Redis proxy control plane."""

import json
import os
import time
import unittest
import uuid
from types import SimpleNamespace

from services import proxy_service, proxy_store


@unittest.skipUnless(
    os.environ.get("PROXY_FEATURE_ENABLED", "false").lower() == "true",
    "proxy runtime is disabled",
)
class ProxyRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        proxy_store.init_proxy_runtime()

    def test_manual_soc_override_wins_over_ml_unknown(self):
        suffix = uuid.uuid4().hex[:12]
        domain = f"test-{suffix}.afferent.invalid"
        client_ip = f"2001:db8:{suffix[:4]}:{suffix[4:8]}::1"
        employee = SimpleNamespace(
            account_id=900000 + int(suffix[:4], 16),
            email=f"employee-{suffix}@afferent.test",
            role="employee",
        )
        soc = SimpleNamespace(
            email="soc-test@afferent.test",
            role="soc",
        )

        registered = proxy_service.register_device(employee, client_ip, "Integration test")
        self.assertTrue(registered["registered"])

        first = proxy_service.decide(
            target=f"https://{domain}/private-path",
            method="CONNECT",
            port=443,
            client_ip=client_ip,
            event_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
        )
        self.assertEqual(first["action"], "allow")
        self.assertEqual(first["source"], "ml_unknown")
        connected = proxy_service.current_device_status(employee, client_ip)
        self.assertTrue(connected["connected"])
        self.assertIsNotNone(connected["lastProxySeenAt"])

        proxy_service.manual_decision(
            domain_value=domain,
            action="block",
            reason="Confirmed malicious by SOC integration test",
            identity=soc,
            request_id=str(uuid.uuid4()),
        )
        second = proxy_service.decide(
            target=f"portal.{domain}",
            method="CONNECT",
            port=443,
            client_ip=client_ip,
            event_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
        )
        self.assertEqual(second["action"], "block")
        self.assertEqual(second["source"], "soc")

        with proxy_store.connection() as conn:
            audit_count = conn.execute(
                "SELECT COUNT(*) AS count FROM proxy_decision_audit WHERE domain = %s",
                (domain,),
            ).fetchone()["count"]
        self.assertEqual(audit_count, 1)
        with self.assertRaises(Exception):
            with proxy_store.connection() as conn:
                conn.execute(
                    "UPDATE proxy_decision_audit SET reason = 'tampered' WHERE domain = %s",
                    (domain,),
                )

        for _ in range(20):
            if len(proxy_store.list_traffic(10, employee.account_id)) >= 2:
                break
            time.sleep(0.1)
        self.assertGreaterEqual(len(proxy_store.list_traffic(10, employee.account_id)), 2)

    def test_normalization_is_domain_only(self):
        self.assertEqual(
            proxy_service.normalize_domain("https://ExAmPle.com/secret?q=1"),
            "example.com",
        )
        self.assertEqual(proxy_service.normalize_domain("example.com:443"), "example.com")
        self.assertEqual(
            proxy_service.normalize_policy_domain("https://www.Example.com/path"),
            "example.com",
        )
        with self.assertRaises(proxy_service.ProxyError):
            proxy_service.normalize_policy_domain("www.example.com';")
        with self.assertRaises(proxy_service.ProxyError):
            proxy_service.normalize_policy_domain("co.id")

        self.assertEqual(
            proxy_service._domain_candidates("www.portal.example.com"),
            ["portal.example.com", "www.portal.example.com", "example.com"],
        )

    def test_unconfigured_ml_alerts_are_hidden_from_soc_queue(self):
        alerts = proxy_service.list_alerts(500)
        self.assertFalse(any(
            item.get("source") == "ml"
            and item.get("reason") == "Model ML belum dikonfigurasi"
            for item in alerts
        ))

    def test_default_allow_is_persisted_and_published_without_device_binding(self):
        suffix = uuid.uuid4().hex[:12]
        domain = f"unregistered-{suffix}.afferent.invalid"
        pubsub = proxy_store.redis_client().pubsub(ignore_subscribe_messages=True)
        pubsub.subscribe("proxy:soc-events")
        with proxy_store.connection() as conn:
            before = conn.execute(
                "SELECT COUNT(*) AS count FROM proxy_traffic_events WHERE domain = %s",
                (domain,),
            ).fetchone()["count"]

        decision = proxy_service.decide(
            target=domain,
            method="CONNECT",
            port=443,
            client_ip=f"2001:db8:ffff:{suffix[:4]}::1",
            event_id=str(uuid.uuid4()),
            request_id=str(uuid.uuid4()),
        )
        self.assertEqual(decision["action"], "allow")
        self.assertEqual(decision["source"], "ml_unknown")
        self.assertFalse(decision["deviceAuthenticated"])

        published = False
        after = before
        for _ in range(30):
            message = pubsub.get_message(timeout=0.1)
            if message:
                payload = json.loads(message["data"])
                published = (
                    payload.get("type") == "traffic.observed"
                    and payload.get("traffic", {}).get("domain") == domain
                ) or published
            with proxy_store.connection() as conn:
                after = conn.execute(
                    "SELECT COUNT(*) AS count FROM proxy_traffic_events WHERE domain = %s",
                    (domain,),
                ).fetchone()["count"]
            if published and after > before:
                break
            time.sleep(0.1)
        pubsub.close()
        self.assertGreater(after, before)
        self.assertTrue(published)


if __name__ == "__main__":
    unittest.main()
