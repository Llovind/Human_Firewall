"""Small, isolated regression checks; no real DB, SMTP, or network calls."""
import os
import unittest
from unittest.mock import patch

from services import proxy_service as service


class ProxyGateTests(unittest.TestCase):
    def test_pending_does_not_allow_first_request_or_blacklist_timeout(self):
        with patch.object(service.proxy_store, "acquire_scan_lock", return_value=False), \
             patch.object(service, "_effective_verdict", return_value=None), \
             patch.dict(os.environ, {"ML_SCANNER_TIMEOUT_SECONDS": "0.001"}):
            self.assertEqual(service._decide_unknown("example.test", None, "test")[0:2], ("block", "ml_pending"))
        with patch.object(service.proxy_store, "acquire_scan_lock", return_value=True), \
             patch.object(service.proxy_store, "release_scan_lock"), \
             patch.object(service, "_effective_verdict", return_value=None), \
             patch.object(service, "_call_ml", side_effect=TimeoutError), \
             patch.object(service, "_persist_ml_verdict") as persist:
            self.assertEqual(service._decide_unknown("example.test", None, "test")[0:2], ("block", "ml_unavailable"))
            persist.assert_not_called()

    def test_unknown_is_actual_verdict_not_pending(self):
        with patch.object(service.proxy_store, "acquire_scan_lock", return_value=True), \
             patch.object(service.proxy_store, "release_scan_lock"), \
             patch.object(service.proxy_store, "cache_verdict"), \
             patch.object(service, "_effective_verdict", return_value=None), \
             patch.object(service, "_call_ml", return_value={"verdict": "unknown", "confidence": None, "reason": "Uncertain", "status": "ready"}), \
             patch.object(service, "_alert_for_result"):
            self.assertEqual(service._decide_unknown("example.test", None, "test")[0:2], ("allow", "ml_unknown"))

    def test_soc_override_during_inference_is_not_lost(self):
        for decision in ("block", "allow"):
            with patch.object(service.proxy_store, "acquire_scan_lock", return_value=True), \
                 patch.object(service.proxy_store, "release_scan_lock"), \
                 patch.object(service, "_effective_verdict", return_value={"source": "soc", "decision": decision, "reason": "SOC decision"}), \
                 patch.object(service, "_call_ml", return_value={"status": "unavailable"}):
                self.assertEqual(service._decide_unknown("example.test", None, "test")[0:2], (decision, "soc"))

    def test_parent_block_overrides_child_whitelist_without_generating_traffic(self):
        rows = {"example.com": {"source": "soc", "decision": "block"},
                "portal.example.com": {"source": "soc", "decision": "allow"}}
        with patch.object(service.proxy_store, "enforcement_verdicts", return_value=rows), \
             patch.object(service.proxy_store, "enqueue_traffic") as traffic, \
             patch.object(service, "_call_ml") as ml:
            self.assertEqual(service.enforcement_decisions(["portal.example.com", "www.example.com", "other.com"]),
                {"portal.example.com": "block", "www.example.com": "block", "other.com": "allow"})
            traffic.assert_not_called()
            ml.assert_not_called()
        for invalid in (None, [], "example.com", [False]):
            with self.assertRaises(service.ProxyError):
                service.enforcement_decisions(invalid)

    def test_external_model_receives_domain_only(self):
        class Result:
            def raise_for_status(self):
                pass
            def json(self):
                return {"verdict": "unknown", "reason": "Test", "modelVersion": "fixture"}
        with patch.dict(os.environ, {"ML_SCANNER_URL": "https://fixture.invalid/scan", "ML_WEBHOOK_SECRET": "fixture-secret"}), \
             patch.object(service.requests, "post", return_value=Result()) as request:
            service._call_ml("example.com", "test", "https://example.com/private?token=SECRET")
            payload = request.call_args.kwargs["data"]
            self.assertNotIn(b"private", payload)
            self.assertNotIn(b"SECRET", payload)
            self.assertIn(b'"inputScope":"domain"', payload)


if __name__ == "__main__":
    unittest.main(verbosity=2)
