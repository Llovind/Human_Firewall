"""Focused security tests for Phase 1 email/password + OTP authentication."""

import os
import tempfile
import unittest
from unittest.mock import patch


TEST_DB = os.path.join(tempfile.gettempdir(), "afferent_phase1_auth.db")
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

os.environ.update({
    "APP_ENV": "test",
    "DB_PATH": TEST_DB,
    "ADMIN_PASSWORD": "BootstrapSecret2026Secure",
    "BOOTSTRAP_ADMIN_EMAIL": "admin@humanfirewall.local",
    "SECRET_KEY": "phase1-test-secret-at-least-32-characters",
    "SERVICE_API_KEY": "phase1-service-key-at-least-32-characters",
    "DEV_BYPASS_AUTH": "false",
    "FLASK_DEBUG": "0",
    "SMTP_HOST": "mailpit",
    "SMTP_PORT": "1025",
    "SMTP_SECURITY": "none",
    "OTP_RESEND_COOLDOWN_SECONDS": "60",
    "OTP_EXPIRY_SECONDS": "300",
})

import database
from app import app
from services import auth_service


class Phase1AuthTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        # Keep this class safe under unittest discovery too: another test class
        # may have removed its temporary database while Python modules remain
        # cached in the same process.
        database.init_db()
        cls.client = app.test_client()
        auth_service.create_account(
            email="employee@demo.local",
            password="StrongPassword2026",
            role="employee",
            division="IT",
        )

    @classmethod
    def tearDownClass(cls):
        active_test_db = database.DB_PATH
        if os.path.exists(active_test_db):
            os.remove(active_test_db)

    def _login(self, email="employee@demo.local", password="StrongPassword2026"):
        captured = {}

        def capture_otp(*, to_address, otp_code, expires_minutes):
            captured.update(email=to_address, otp=otp_code, expires=expires_minutes)

        with patch.object(auth_service.EmailService, "send_login_otp", side_effect=capture_otp):
            response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        return response, captured

    def test_01_schema_and_argon2id_hash(self):
        conn = database.get_connection()
        try:
            tables = {
                row["name"] for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            self.assertTrue({"employee_accounts", "otp_challenges", "auth_sessions", "login_audit"}.issubset(tables))
            row = conn.execute(
                "SELECT password_hash FROM employee_accounts WHERE email='employee@demo.local'"
            ).fetchone()
            self.assertTrue(row["password_hash"].startswith("$argon2id$"))
            self.assertNotIn("StrongPassword2026", row["password_hash"])
        finally:
            conn.close()

    def test_02_otp_is_hashed_single_use_and_session_revocable(self):
        login, captured = self._login()
        self.assertEqual(login.status_code, 200)
        challenge_id = login.get_json()["challengeId"]
        otp = captured["otp"]

        conn = database.get_connection()
        try:
            row = conn.execute(
                "SELECT otp_hash, expires_at, max_attempts FROM otp_challenges WHERE id=?",
                (challenge_id,),
            ).fetchone()
            self.assertNotEqual(row["otp_hash"], otp)
            self.assertEqual(row["max_attempts"], 5)
        finally:
            conn.close()

        wrong = self.client.post("/api/auth/verify-otp", json={"challengeId": challenge_id, "otp": "000000"})
        self.assertEqual(wrong.status_code, 401)

        verified = self.client.post("/api/auth/verify-otp", json={"challengeId": challenge_id, "otp": otp})
        self.assertEqual(verified.status_code, 200)
        session_token = verified.get_json()["sessionToken"]

        session = self.client.get("/api/auth/session", headers={"X-Afferent-Session": session_token})
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.get_json()["user"]["role"], "employee")

        reuse = self.client.post("/api/auth/verify-otp", json={"challengeId": challenge_id, "otp": otp})
        self.assertEqual(reuse.status_code, 400)

        forbidden = self.client.get("/api/admin/employees", headers={"X-Afferent-Session": session_token})
        self.assertEqual(forbidden.status_code, 403)

        conn = database.get_connection()
        try:
            stored = conn.execute("SELECT token_hash FROM auth_sessions ORDER BY created_at DESC LIMIT 1").fetchone()
            self.assertNotEqual(stored["token_hash"], session_token)
        finally:
            conn.close()

        logout = self.client.post("/api/auth/logout", headers={"X-Afferent-Session": session_token})
        self.assertEqual(logout.status_code, 200)
        expired = self.client.get("/api/auth/session", headers={"X-Afferent-Session": session_token})
        self.assertEqual(expired.status_code, 401)

    def test_03_resend_cooldown_and_password_failure_audit(self):
        login, _captured = self._login()
        challenge_id = login.get_json()["challengeId"]
        resend = self.client.post("/api/auth/resend-otp", json={"challengeId": challenge_id})
        self.assertEqual(resend.status_code, 429)

        failed = self.client.post(
            "/api/auth/login",
            json={"email": "employee@demo.local", "password": "WrongPassword2026"},
        )
        self.assertEqual(failed.status_code, 401)
        conn = database.get_connection()
        try:
            audit = conn.execute(
                "SELECT event_type, success FROM login_audit WHERE email='employee@demo.local' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            self.assertEqual(audit["event_type"], "password_failed")
            self.assertEqual(audit["success"], 0)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
