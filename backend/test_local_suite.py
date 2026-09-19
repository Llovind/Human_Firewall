"""Core regression suite after the Phase 1 authentication migration."""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
TEST_DB = os.path.join(tempfile.gettempdir(), "afferent_regression_suite.db")
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

os.environ.update({
    "APP_ENV": "test",
    "DB_PATH": TEST_DB,
    "ADMIN_PASSWORD": "BootstrapAdmin2026",
    "BOOTSTRAP_ADMIN_EMAIL": "admin@humanfirewall.local",
    "SECRET_KEY": "test-secret-key-1234567890-long-enough",
    "SERVICE_API_KEY": "test-service-key-1234567890-long-enough",
    "DEV_BYPASS_AUTH": "false",
    "FLASK_DEBUG": "0",
    "SMTP_HOST": "mailpit",
    "SMTP_PORT": "1025",
    "SMTP_SECURITY": "none",
})

import database
import security
from app import app
from services import auth_service


class AfferentLocalTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # unittest discovery imports every module before executing classes;
        # restore this suite's runtime secret after other test modules have
        # configured their isolated environment.
        os.environ["SERVICE_API_KEY"] = "test-service-key-1234567890-long-enough"
        app.config["TESTING"] = True
        cls.client = app.test_client()
        cls.service_headers = {"Authorization": "Bearer test-service-key-1234567890-long-enough"}

        # Existing seeded telemetry stays intact; accounts are linked separately.
        auth_service.create_account(
            email="employee.regression@demo.local",
            password="EmployeeSecure2026",
            role="employee",
            division="IT",
        )
        auth_service.create_account(
            email="ciso.regression@demo.local",
            password="CisoSecurePassword2026",
            role="ciso",
            division="IT",
        )
        cls.employee_token = cls._login("employee.regression@demo.local", "EmployeeSecure2026")
        cls.ciso_token = cls._login("ciso.regression@demo.local", "CisoSecurePassword2026")
        cls.phishing_admin_token = cls._login("admin@humanfirewall.local", "BootstrapAdmin2026")

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)

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

    def test_01_legacy_identity_endpoints_are_retired(self):
        for method, path, payload in (
            ("post", "/api/auth/admin", {"password": "BootstrapAdmin2026"}),
            ("post", "/api/telegram/command", {"chat_id": "1", "command": "/start"}),
            ("get", "/api/auth/validate-token?token=legacy", None),
        ):
            response = getattr(self.client, method)(path, json=payload) if payload else getattr(self.client, method)(path)
            self.assertEqual(response.status_code, 410)

    def test_02_threat_reporting_and_gamification_still_work(self):
        payload = {
            "employee_id": "employee.regression@demo.local",
            "type": "url",
            "target": "https://eicar.example/test",
            "verdict": "malicious",
            "source_engine": "vt",
            "severity_tier": "high",
            "submitted_at": "2026-08-15T21:00:00Z",
        }
        response = self.client.post("/api/reports", json=payload, headers=self.service_headers)
        self.assertIn(response.status_code, (200, 201))
        conn = database.get_connection()
        try:
            report = conn.execute(
                "SELECT verdict FROM threat_reports WHERE email=? ORDER BY id DESC LIMIT 1",
                ("employee.regression@demo.local",),
            ).fetchone()
            self.assertEqual(report["verdict"], "malicious")
        finally:
            conn.close()

    def test_03_compliance_and_dashboard_metrics_preserved(self):
        headers = {"X-Afferent-Session": self.ciso_token}
        compliance = self.client.get("/api/compliance-summary", headers=headers)
        self.assertEqual(compliance.status_code, 200)
        self.assertIn("clause_readiness", compliance.get_json())

        summary = self.client.get("/api/dashboard-summary", headers=headers)
        self.assertEqual(summary.status_code, 200)
        self.assertIn("divisi_scores", summary.get_json())

        leaderboard = self.client.get("/api/admin/leaderboard", headers=headers)
        self.assertEqual(leaderboard.status_code, 200)
        self.assertIn("individual", leaderboard.get_json())

    def test_04_employee_activity_and_eligibility_preserved(self):
        email = "employee.regression@demo.local"
        headers = {"X-Afferent-Session": self.employee_token}
        activity = self.client.get(f"/api/user-activity?email={email}", headers=headers)
        self.assertEqual(activity.status_code, 200)
        self.assertIsInstance(activity.get_json()["activities"], list)

        eligibility = self.client.get(f"/api/user-eligibility?email={email}", headers=headers)
        self.assertEqual(eligibility.status_code, 200)
        self.assertIn("eligible", eligibility.get_json())

    def test_05_employee_cannot_read_another_profile(self):
        response = self.client.get(
            "/api/user-activity?email=ciso.regression@demo.local",
            headers={"X-Afferent-Session": self.employee_token},
        )
        self.assertEqual(response.status_code, 403)

    def test_06_reports_summary_and_daily_quiz_preserved(self):
        email = "employee.regression@demo.local"
        headers = {"X-Afferent-Session": self.employee_token}
        report = self.client.get(f"/api/employee/{email}/reports-summary", headers=headers)
        self.assertEqual(report.status_code, 200)
        self.assertIn("badges", report.get_json())

        quiz = self.client.get(f"/api/quiz/today?employee_id={email}", headers=headers)
        self.assertEqual(quiz.status_code, 200)
        self.assertTrue(any(key in quiz.get_json() for key in ("question_text", "message", "completed_today")))

    def test_07_sensitive_routes_are_deny_by_default(self):
        for path in ("/api/ai/router/status", "/api/emails", "/api/incidents"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

        # The historical hardcoded magic token must not authenticate telemetry.
        retired_magic = self.client.post("/api/event", json={
            "email": "lovind@netengineering-dummy.local",
            "event_type": "viewed_training",
            "token": "demo-magic-link-2026",
        })
        self.assertEqual(retired_magic.status_code, 401)

    def test_08_simulation_token_still_protects_training_telemetry(self):
        email = "employee.regression@demo.local"
        token = security.create_simulation_token(email, "security-test")
        self.assertEqual(self.client.get(f"/api/user-profile?email={email}").status_code, 401)
        profile = self.client.get(f"/api/user-profile?email={email}&simulation_token={token}")
        self.assertEqual(profile.status_code, 200)
        event = self.client.post("/api/event", json={
            "email": email,
            "event_type": "viewed_training",
            "simulation_token": token,
        })
        self.assertEqual(event.status_code, 201)

    def test_09_production_rejects_auth_bypass(self):
        for unsafe in (
            {"DEV_BYPASS_AUTH": "true", "FLASK_DEBUG": "false"},
            {"DEV_BYPASS_AUTH": "false", "FLASK_DEBUG": "true"},
        ):
            with self.subTest(**unsafe), patch.dict(os.environ, {"APP_ENV": "production", **unsafe}, clear=False):
                with self.assertRaises(RuntimeError):
                    security.validate_runtime_security()

    def test_10_phishing_admin_can_create_every_privileged_role(self):
        headers = {"X-Afferent-Session": self.phishing_admin_token}
        for role in ("soc", "grc", "ciso"):
            with self.subTest(role=role):
                response = self.client.post(
                    "/api/admin/employees",
                    headers=headers,
                    json={
                        "email": f"{role}.created@demo.local",
                        "password": f"Secure{role.upper()}Password2026",
                        "role": role,
                        "divisi": "Security Operations",
                        "is_active": 1,
                    },
                )
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.get_json()["account"]["role"], role)

    def test_11_proxy_registration_allows_preflight_but_not_unauthenticated_post(self):
        preflight = self.client.options(
            "/api/proxy/device/register",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(
            preflight.headers.get("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )
        self.assertEqual(
            self.client.post("/api/proxy/device/register", json={}).status_code,
            401,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
