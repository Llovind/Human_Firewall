"""
test_threat_scan_daily_cap.py — Unit tests covering:
1. Server-side user_tier resolution from authenticated session (never client body/params)
2. Demo seed cache hit (source="demo_seed", is_demo_seed=True)
3. Rate limit handling and SOC status ("Dispatched to SOC" only if ticket created; "Scanner busy, retry" when rate-limited)
4. Daily cap 3 reward/hari per email in WIB timezone (UTC+7), deduplication, and zero rewards for safe verdicts.
"""

# Historical tests for the retired mixed-provider Telegram gateway. Not active.
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import database
from app import app
from services import auth_service
from services import threat_service
import policy


class ThreatScanDailyCapTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

        # Create distinct test accounts for Sentinel, Guardian, Vulnerable tiers
        for em, pw, div in [
            ("sentinel.test@infranexia.co.id", "SentinelPassword2026", "Engineering"),
            ("vulnerable.test@infranexia.co.id", "VulnerablePassword2026", "Finance"),
            ("guardian.test@infranexia.co.id", "GuardianPassword2026", "Operations"),
        ]:
            try:
                auth_service.create_account(email=em, password=pw, role="employee", division=div)
            except auth_service.AuthError:
                pass

        # Force reputation points/badges in user_history:
        # Sentinel: points >= 130
        database.adjust_points("sentinel.test@infranexia.co.id", "Engineering", 50)  # 100+50 = 150 -> Sentinel
        # Vulnerable: points < 60
        database.adjust_points("vulnerable.test@infranexia.co.id", "Finance", -50)  # 100-50 = 50 -> Vulnerable
        # Guardian: default 100

        cls.sentinel_token = cls._login("sentinel.test@infranexia.co.id", "SentinelPassword2026")
        cls.vulnerable_token = cls._login("vulnerable.test@infranexia.co.id", "VulnerablePassword2026")
        cls.guardian_token = cls._login("guardian.test@infranexia.co.id", "GuardianPassword2026")

        # Ensure threat_cache has demo seed items
        from seed_threat_cache import seed_threat_cache
        seed_threat_cache()

    @classmethod
    def _login(cls, email, password):
        captured = {}

        def capture_otp(*, to_address, otp_code, expires_minutes):
            captured["otp"] = otp_code

        with patch.object(auth_service.EmailService, "send_login_otp", side_effect=capture_otp):
            login = cls.client.post("/api/auth/login", json={"email": email, "password": password})
        challenge_id = login.get_json()["challengeId"]
        verified = cls.client.post(
            "/api/auth/verify-otp",
            json={"challengeId": challenge_id, "otp": captured["otp"]},
        )
        return verified.get_json()["sessionToken"]

    def test_01_server_side_user_tier_resolution(self):
        """Test user tier is resolved server-side from session and client body manipulation is rejected."""
        # Sentinel user scans a suspicious URL
        headers = {"X-Afferent-Session": self.sentinel_token}
        res_sentinel = self.client.post(
            "/api/threat/analyze",
            headers=headers,
            json={
                "indicator": "https://portal-payroll-sso.xyz/login",
                "user_tier": "Vulnerable",  # Attacker attempts to spoof tier to Vulnerable
                "tier": "Vulnerable",
            }
        )
        self.assertEqual(res_sentinel.status_code, 200)
        data_sentinel = res_sentinel.get_json()
        self.assertEqual(data_sentinel["user_tier"], "Sentinel")
        self.assertEqual(data_sentinel["user_email"], "sentinel.test@infranexia.co.id")

        # Vulnerable user scans the same suspicious URL
        headers_vuln = {"X-Afferent-Session": self.vulnerable_token}
        res_vuln = self.client.post(
            "/api/threat/analyze",
            headers=headers_vuln,
            json={
                "indicator": "https://portal-payroll-sso.xyz/login",
                "user_tier": "Sentinel",  # Attacker attempts to spoof tier to Sentinel
                "tier": "Sentinel",
            }
        )
        self.assertEqual(res_vuln.status_code, 200)
        data_vuln = res_vuln.get_json()
        self.assertEqual(data_vuln["user_tier"], "Vulnerable")
        self.assertEqual(data_vuln["user_email"], "vulnerable.test@infranexia.co.id")

        # Verify 2D Adaptive Policy output differences between Sentinel and Vulnerable for the same indicator
        self.assertIn("policy", data_sentinel)
        self.assertIn("policy", data_vuln)
        # 2D policy matrix includes comparative mapping for all tiers
        self.assertIn("comparative", data_sentinel["policy"])
        self.assertIn("Sentinel", data_sentinel["policy"]["comparative"])
        self.assertIn("Vulnerable", data_sentinel["policy"]["comparative"])

    def test_02_demo_seed_cache_hit_and_cached_badge(self):
        """Verify seeded indicator returns cache_hit=True and is_demo_seed=True with source 'demo_seed'."""
        headers = {"X-Afferent-Session": self.guardian_token}
        res = self.client.post(
            "/api/threat/analyze",
            headers=headers,
            json={"indicator": "https://finance-urgent-invoice.top/update.exe"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["cache_hit"])
        self.assertTrue(data["is_demo_seed"])
        self.assertIn("demo_seed", data["analysis"]["source"])
        self.assertEqual(data["analysis"]["verdict"], "malicious")

    def test_03_rate_limit_and_soc_dispatch_contract(self):
        """Pesan 'dispatched to SOC' hanya muncul jika tiket dibuat; 'Scanner busy, retry' jika rate-limited."""
        # Case A: Malicious scan creates incident ticket -> soc_status mentions Ticket #
        headers = {"X-Afferent-Session": self.sentinel_token}
        res_malicious = self.client.post(
            "/api/threat/analyze",
            headers=headers,
            json={"indicator": "https://finance-urgent-invoice.top/update.exe"}
        )
        self.assertEqual(res_malicious.status_code, 200)
        data_mal = res_malicious.get_json()
        self.assertTrue(data_mal["policy"]["action"] == "block")
        self.assertIsNotNone(data_mal.get("ticket_id"))
        self.assertTrue(data_mal.get("soc_status", "").startswith("Dispatched to SOC"))

        # Case B: Rate limit simulation (429) on new indicator without cache
        with patch("integrations.scan_virustotal", return_value={"success": False, "status_code": 429, "error": "Rate limit exceeded (429)", "data": None}), \
             patch("integrations.scan_urlscan", return_value={"success": False, "status_code": 429, "error": "Rate limit exceeded (429)", "data": None}):
            res_busy = self.client.post(
                "/api/threat/analyze",
                headers=headers,
                json={"indicator": "https://brand-new-uncached-threat-domain.net/test"}
            )
            self.assertEqual(res_busy.status_code, 200)
            data_busy = res_busy.get_json()
            self.assertTrue(data_busy.get("scanner_busy"))
            self.assertEqual(data_busy.get("soc_status"), "Scanner busy, retry")
            self.assertIsNone(data_busy.get("ticket_id"))

    def test_04_wib_timezone_calculation(self):
        """Verify get_current_wib_date returns correct UTC+7 date."""
        wib_date = database.get_current_wib_date()
        expected = datetime.now(timezone(timedelta(hours=7))).strftime("%Y-%m-%d")
        self.assertEqual(wib_date, expected)

    def test_05_daily_cap_and_deduplication(self):
        """Verify daily cap 3 reward/hari per email, deduplication, and zero rewards for safe scans."""
        test_email = "bounty.hunter@infranexia.co.id"
        try:
            auth_service.create_account(
                email=test_email,
                password="HunterPassword2026",
                role="employee",
                division="CyberSecurity",
            )
        except auth_service.AuthError:
            pass

        # Reset any previous rewards for this test user
        conn = database.get_connection()
        conn.execute("DELETE FROM threat_rewards WHERE email = ?", (test_email,))
        conn.execute("DELETE FROM threat_reports WHERE email = ?", (test_email,))
        conn.commit()
        conn.close()

        token = self._login(test_email, "HunterPassword2026")
        headers = {"X-Afferent-Session": token}

        # Step A: Safe scan does NOT award points
        with patch("routes.threat.analyze_indicator", return_value={
            "cache_hit": False,
            "analysis": {"verdict": "clean", "severity": "low", "confidence": 95, "scores": {"vt": 0, "urlscan": 0}},
            "policy": {"action": "allow", "reason": "Clean indicator", "confidence": 95, "severity": "low", "verdict": "clean"}
        }):
            res_safe = self.client.post(
                "/api/threat/analyze",
                headers=headers,
                json={"indicator": "https://completely-safe-domain.com"}
            )
            data_safe = res_safe.get_json()
            self.assertFalse(data_safe["reward"]["awarded"])
            self.assertEqual(data_safe["reward"]["points"], 0)

        # Step B: 3 unique suspicious/malicious scans -> Each awards +15 points
        for i in range(1, 4):
            mock_url = f"https://unique-malicious-domain-{i}.com/malware"
            with patch("routes.threat.analyze_indicator", return_value={
                "cache_hit": False,
                "analysis": {"verdict": "malicious", "severity": "high", "confidence": 90, "scores": {"vt": 10, "urlscan": 80}},
                "policy": {"action": "block", "reason": "Malicious indicator", "confidence": 90, "severity": "high", "verdict": "malicious"}
            }):
                res = self.client.post(
                    "/api/threat/analyze",
                    headers=headers,
                    json={"indicator": mock_url}
                )
                data = res.get_json()
                self.assertTrue(data["reward"]["awarded"], f"Scan {i} should be awarded")
                self.assertEqual(data["reward"]["points_awarded"], 15)
                self.assertEqual(data["reward"]["daily_count"], i)
                self.assertEqual(data["reward"]["daily_cap"], 3)

        # Step C: 4th unique scan on the same day -> Reaches daily cap (0 points awarded)
        with patch("routes.threat.analyze_indicator", return_value={
            "cache_hit": False,
            "analysis": {"verdict": "malicious", "severity": "high", "confidence": 90, "scores": {"vt": 10, "urlscan": 80}},
            "policy": {"action": "block", "reason": "Malicious indicator", "confidence": 90, "severity": "high", "verdict": "malicious"}
        }):
            res_cap = self.client.post(
                "/api/threat/analyze",
                headers=headers,
                json={"indicator": "https://fourth-malicious-domain.com/over-cap"}
            )
            data_cap = res_cap.get_json()
            self.assertFalse(data_cap["reward"]["awarded"])
            self.assertEqual(data_cap["reward"]["points"], 0)
            self.assertIn("Batas kuota harian", data_cap["reward"]["reason"])
            self.assertEqual(data_cap["reward"]["daily_count"], 3)

        # Step D: Duplicate target on the same email -> Deduplication prevents re-awarding
        with patch("routes.threat.analyze_indicator", return_value={
            "cache_hit": False,
            "analysis": {"verdict": "malicious", "severity": "high", "confidence": 90, "scores": {"vt": 10, "urlscan": 80}},
            "policy": {"action": "block", "reason": "Malicious indicator", "confidence": 90, "severity": "high", "verdict": "malicious"}
        }):
            res_dupe = self.client.post(
                "/api/threat/analyze",
                headers=headers,
                json={"indicator": "https://unique-malicious-domain-1.com/malware"}
            )
            data_dupe = res_dupe.get_json()
            self.assertFalse(data_dupe["reward"]["awarded"])
            self.assertIn("sudah pernah", data_dupe["reward"]["reason"])


if __name__ == "__main__":
    unittest.main()
