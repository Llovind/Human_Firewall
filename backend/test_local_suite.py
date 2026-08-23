"""
test_local_suite.py — Comprehensive Local Test Suite for Afferent Security Platform
Tests all core business logic, database migrations, auth, OTP, telegram commands,
threat intelligence, and compliance metrics using Flask test_client.
"""

import unittest
import json
import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure environment before importing app
os.environ['ADMIN_PASSWORD'] = 'hfl-admin-2026'
os.environ['SECRET_KEY'] = 'test-secret-key-1234567890'
os.environ['SERVICE_API_KEY'] = 'test-service-key-1234567890'
os.environ['DEV_BYPASS_AUTH'] = 'false'
os.environ['FLASK_DEBUG'] = '0'

import database
from app import app

class AfferentLocalTestSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Set up test database and test client."""
        app.config['TESTING'] = True
        cls.client = app.test_client()
        # Initialize DB in test mode
        database.init_db()
        conn = database.get_connection()
        conn.execute("DELETE FROM user_history WHERE email = 'hadi.wijaya@infranexia.co.id'")
        conn.execute("DELETE FROM registration_otp WHERE telegram_chat_id = '111222333' OR email = 'hadi.wijaya@infranexia.co.id'")
        conn.execute("DELETE FROM inbox_emails WHERE to_email = 'hadi.wijaya@infranexia.co.id'")
        conn.execute("DELETE FROM threat_reports WHERE email = 'hadi.wijaya@infranexia.co.id'")
        conn.execute("DELETE FROM dashboard_tokens WHERE email = 'hadi.wijaya@infranexia.co.id'")
        conn.commit()
        conn.close()

    def test_01_admin_login_success(self):
        """Test Admin login with correct password."""
        res = self.client.post('/api/auth/admin', json={'password': 'hfl-admin-2026'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('user', {}).get('role'), 'admin')

    def test_02_admin_login_failure(self):
        """Test Admin login with incorrect password."""
        res = self.client.post('/api/auth/admin', json={'password': 'wrong-password'})
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn('error', data)

    def test_03_telegram_start_unregistered(self):
        """Test Telegram /start command from an unregistered user."""
        test_chat_id = "111222333"
        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': '/start',
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        reply = data.get('reply', '')
        self.assertIn('Afferent Security Bot', reply)
        self.assertIn('Panduan Pendaftaran Akun', reply)
        self.assertIn('<b>', reply) # Verifies HTML mode format

    def test_04_telegram_email_registration_and_otp(self):
        """Test user submitting corporate email in Telegram, generating OTP and webmail inbox entry."""
        test_chat_id = "111222333"
        test_email = "hadi.wijaya@infranexia.co.id"

        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': test_email,
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        reply = res.get_json().get('reply', '')
        self.assertIn('Inbox Webmail', reply)

        # Verify OTP in Database
        conn = database.get_connection()
        otp_row = conn.execute(
            'SELECT * FROM registration_otp WHERE telegram_chat_id = ? ORDER BY created_at DESC LIMIT 1',
            (test_chat_id,)
        ).fetchone()
        self.assertIsNotNone(otp_row)
        self.assertEqual(otp_row['email'], test_email)
        self.assertEqual(len(otp_row['otp_code']), 6)

        # Verify Email in Webmail Inbox
        inbox_row = conn.execute(
            'SELECT * FROM inbox_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1',
            (test_email,)
        ).fetchone()
        self.assertIsNotNone(inbox_row)
        self.assertIn(otp_row['otp_code'], inbox_row['body'])
        conn.close()

    def test_05_telegram_otp_verification_wrong_code(self):
        """Test submitting incorrect OTP code."""
        test_chat_id = "111222333"
        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': '000000', # wrong OTP
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        reply = res.get_json().get('reply', '')
        self.assertIn('❌', reply)
        self.assertIn('salah', reply.lower())

    def test_06_telegram_otp_verification_success(self):
        """Test submitting correct OTP code to link account."""
        test_chat_id = "111222333"
        test_email = "hadi.wijaya@infranexia.co.id"

        conn = database.get_connection()
        otp_row = conn.execute(
            'SELECT otp_code FROM registration_otp WHERE telegram_chat_id = ? ORDER BY created_at DESC LIMIT 1',
            (test_chat_id,)
        ).fetchone()
        otp_code = otp_row['otp_code']
        conn.close()

        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': otp_code,
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        reply = res.get_json().get('reply', '')
        self.assertIn('✅', reply)
        self.assertIn('Verifikasi Berhasil', reply)
        self.assertIn(test_email, reply)

        # Verify user record is linked
        conn = database.get_connection()
        user_row = conn.execute('SELECT * FROM user_history WHERE email = ?', (test_email,)).fetchone()
        self.assertEqual(user_row['telegram_chat_id'], test_chat_id)
        conn.close()

    def test_07_telegram_profile_registered(self):
        """Test /profile command for registered user."""
        test_chat_id = "111222333"
        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': '/profile',
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        reply = res.get_json().get('reply', '')
        self.assertIn('Profil Keamanan Anda', reply)
        self.assertIn('hadi.wijaya@infranexia.co.id', reply)
        self.assertIn('Skor Kepatuhan', reply)

    def test_08_telegram_dashboard_magic_link(self):
        """Test /dashboard command generating Magic Link."""
        test_chat_id = "111222333"
        res = self.client.post('/api/telegram/command', json={
            'chat_id': test_chat_id,
            'command': '/dashboard',
            'first_name': 'Hadi'
        })
        self.assertEqual(res.status_code, 200)
        reply = res.get_json().get('reply', '')
        self.assertIn('Link Akses Dashboard Anda', reply)
        self.assertIn('/auth?token=', reply)

        # Extract token and test validate endpoint
        import re
        match = re.search(r'/auth\?token=([a-f0-9\-]+)', reply)
        self.assertIsNotNone(match)
        token = match.group(1)

        val_res = self.client.get(f'/api/auth/validate-token?token={token}')
        self.assertEqual(val_res.status_code, 200)
        val_data = val_res.get_json()
        self.assertTrue(val_data.get('valid'))
        self.assertEqual(val_data.get('user', {}).get('email'), 'hadi.wijaya@infranexia.co.id')

    def test_09_threat_intelligence_incident_creation(self):
        """Test threat intelligence report and incident creation."""
        test_email = "hadi.wijaya@infranexia.co.id"
        headers = {'Authorization': 'Bearer test-service-key-1234567890'}

        # Post report via service API
        report_payload = {
            "employee_id": test_email,
            "telegram_user_id": "111222333",
            "type": "file",
            "target": "eicar_test_virus.com",
            "verdict": "malicious",
            "source_engine": "vt",
            "severity_tier": "high",
            "submitted_at": "2026-08-15T21:00:00Z"
        }
        res = self.client.post('/api/reports', json=report_payload, headers=headers)
        self.assertIn(res.status_code, [200, 201])

        # Verify incident is recorded in threat_reports
        conn = database.get_connection()
        inc_row = conn.execute(
            'SELECT * FROM threat_reports WHERE email = ? ORDER BY submitted_at DESC LIMIT 1',
            (test_email,)
        ).fetchone()
        self.assertIsNotNone(inc_row)
        self.assertEqual(inc_row['verdict'], 'malicious')
        self.assertEqual(inc_row['severity_tier'], 'high')
        conn.close()

    def test_11_compliance_summary(self):
        """Test ISO 27001 & UU PDP compliance summary metrics."""
        headers = {'Authorization': 'Bearer test-service-key-1234567890'}
        res = self.client.get('/api/compliance-summary?role=ciso', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('clause_readiness', data)
        self.assertIn('overall_readiness_indicator', data)

    def test_12_dashboard_summary_and_leaderboard(self):
        """Test admin dashboard aggregate metrics and leaderboard ranking."""
        headers = {'Authorization': 'Bearer test-service-key-1234567890'}
        res = self.client.get('/api/dashboard-summary', headers=headers)
        self.assertEqual(res.status_code, 200)
        summary = res.get_json()
        self.assertIn('divisi_scores', summary)

        lead_res = self.client.get('/api/admin/leaderboard', headers=headers)
        self.assertEqual(lead_res.status_code, 200)
        leaderboard = lead_res.get_json()
        self.assertIn('individual', leaderboard)
        self.assertIn('by_divisi', leaderboard)

    def test_13_user_activity_feed(self):
        """Test personal user activity timeline feed."""
        test_email = "hadi.wijaya@infranexia.co.id"
        # Seed a dashboard token
        conn = database.get_connection()
        token = "test-token-activity-123"
        conn.execute("INSERT OR REPLACE INTO dashboard_tokens (token, email, expires_at) VALUES (?, ?, ?)",
                     (token, test_email, (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()))
        conn.commit()
        conn.close()

        res = self.client.get(f'/api/user-activity?email={test_email}&token={token}')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('activities', data)
        self.assertIsInstance(data['activities'], list)

    def test_14_user_eligibility_spot_fake(self):
        """Test spot-the-fake mini game eligibility logic."""
        test_email = "hadi.wijaya@infranexia.co.id"
        token = "test-token-activity-123"
        res = self.client.get(f'/api/user-eligibility?email={test_email}&token={token}')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('eligible', data)

    def test_15_reports_summary_gamification(self):
        """Test employee gamification & threat reporting summary."""
        test_email = "hadi.wijaya@infranexia.co.id"
        token = "test-token-activity-123"
        res = self.client.get(f'/api/employee/{test_email}/reports-summary?token={token}')
        self.assertEqual(res.status_code, 200)
        summary = res.get_json()
        self.assertIn('badges', summary)
        self.assertIn('reports_count_malicious', summary)
        self.assertIn('reports_count_total', summary)

    def test_16_quiz_today(self):
        """Test Daily Quiz generation and retrieval."""
        test_email = "hadi.wijaya@infranexia.co.id"
        token = "test-token-activity-123"
        res = self.client.get(f'/api/quiz/today?employee_id={test_email}&token={token}')
        self.assertEqual(res.status_code, 200)
        q = res.get_json()
        self.assertTrue('question_text' in q or 'message' in q or 'completed_today' in q)

if __name__ == '__main__':
    unittest.main(verbosity=2)
