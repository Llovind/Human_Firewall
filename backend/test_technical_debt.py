"""Isolated report, low-score Mailpit, password and RBAC regression checks."""
import os
import tempfile
import unittest
import uuid
from contextlib import closing
from unittest.mock import Mock, patch

_temp = tempfile.TemporaryDirectory()
os.environ.update(APP_ENV='test', DB_PATH=os.path.join(_temp.name, 'test.db'),
                  ADMIN_PASSWORD='TestingAdmin2026!', SECRET_KEY='isolated-test-secret-32-characters',
                  SERVICE_API_KEY='isolated-service-key-32-characters', DEV_BYPASS_AUTH='false',
                  PROXY_FEATURE_ENABLED='false', AI_HEATMAP_USE_LLM='false', EDUCATION_SCORE_THRESHOLD='60',
                  SMTP_HOST='mailpit', SMTP_PORT='1025', SMTP_SECURITY='none')

import database
import integrations
from app import app
from services import auth_service, notification_service, report_service


def login(email, password):
    otp = {}
    with patch.object(auth_service.EmailService, 'send_login_otp', side_effect=lambda **values: otp.update(values)):
        challenge = app.test_client().post('/api/auth/login', json={'email': email, 'password': password}).get_json()
    response = app.test_client().post('/api/auth/verify-otp', json={'challengeId': challenge['challengeId'], 'otp': otp['otp_code']})
    return response.get_json()['sessionToken']


class TechnicalDebtChecks(unittest.TestCase):
    def setUp(self):
        self.email = f'{uuid.uuid4().hex}@demo.test'
        self.password = 'EmployeeTesting2026!'
        auth_service.create_account(email=self.email, password=self.password, role='employee', division='IT')
        self.token = login(self.email, self.password)
        self.headers = {'X-Afferent-Session': self.token}
        self.client = app.test_client()

    def test_report_cache_atomic_reward_and_duplicate(self):
        url = 'https://report.example.test/path'
        analysis = {'analysisVersion': 2, 'providers': ['virustotal'], 'verdict': 'malicious', 'severity': 'high', 'confidence': 90, 'evidence': {}}
        database.save_threat_cache(url, 'url', analysis)
        redis = Mock()
        redis.lock.return_value.acquire.return_value = True
        redis.incr.return_value = 1
        alert = {'id': str(uuid.uuid4()), 'status': 'open'}
        before = database.get_user_history(self.email)['points']
        with patch.object(report_service.proxy_store, 'redis_client', return_value=redis), patch.object(report_service.proxy_store, 'create_alert', return_value=alert) as created, patch.object(report_service.proxy_store, 'get_alert', return_value=alert), patch.object(integrations, 'scan_virustotal') as external:
            result = self.client.post('/api/reports', json={'url': url, 'email': 'another@test'}, headers=self.headers)
            self.assertEqual(result.status_code, 201, result.get_json())
            self.assertTrue(result.get_json()['reward']['awarded'])
            duplicate = self.client.post('/api/reports', json={'url': url}, headers=self.headers)
            self.assertTrue(duplicate.get_json()['duplicate'])
            self.assertEqual(created.call_count, 1)
            external.assert_not_called()
            reports = self.client.get('/api/reports', headers=self.headers).get_json()['reports']
            self.assertEqual(len(reports), 1)
            self.assertEqual(reports[0]['email'], self.email)
            self.assertEqual(reports[0]['status'], 'under review')
        self.assertEqual(database.get_user_history(self.email)['points'], before + 15)
        self.assertEqual(database.get_user_history(self.email)['reports_count_malicious'], 1)

    def test_warning_only_below_threshold_and_recovery_skips(self):
        database.adjust_points(self.email, 'IT', -41)  # 59
        notification_service.queue_education()
        notification_service.queue_education()
        with closing(database.get_connection()) as conn:
            count = conn.execute('SELECT COUNT(*) FROM notification_outbox WHERE recipient=?', (self.email,)).fetchone()[0]
        self.assertEqual(count, 1)
        with patch.object(notification_service.EmailService, 'send') as send:
            while notification_service.deliver_one():
                pass
            self.assertTrue(any(call.kwargs['to_address'] == self.email for call in send.call_args_list))
        notification_service.enqueue(self.email, 'Education', 'Learning note', 'recovered:' + self.email)
        database.adjust_points(self.email, 'IT', 1)  # 60 NOT below threshold
        with patch.object(notification_service.EmailService, 'send') as send:
            while notification_service.deliver_one():
                pass
            send.assert_not_called()

    def test_password_revokes_session_and_old_password(self):
        result = self.client.post('/api/auth/change-password', json={'currentPassword': self.password, 'newPassword': 'NewEmployeePassword2026!'}, headers=self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.client.get('/api/auth/session', headers=self.headers).status_code, 401)
        self.assertIsNone(auth_service.get_identity(self.token))
        self.assertEqual(self.client.post('/api/auth/login', json={'email': self.email, 'password': self.password}).status_code, 401)
        self.assertTrue(login(self.email, 'NewEmployeePassword2026!'))

    def test_rbac_and_heatmap_without_llm(self):
        self.assertEqual(self.client.get('/api/ai/classify-all', headers=self.headers).status_code, 403)
        self.assertEqual(self.client.get('/api/incidents', headers=self.headers).status_code, 403)
        self.assertEqual(self.client.post('/api/internal/reports', json={}, headers=self.headers).status_code, 403)
        email = f'soc.{uuid.uuid4().hex}@demo.test'
        auth_service.create_account(email=email, password=self.password, role='soc', division='IT')
        headers = {'X-Afferent-Session': login(email, self.password)}
        with patch('ai_router.call_llm') as llm:
            result = self.client.get('/api/ai/classify-all', headers=headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.get_json()['_source'], 'behavior_rules')
            self.assertTrue(result.get_json()['classifications'])
            llm.assert_not_called()

    def test_absent_provider_evidence_is_not_safe(self):
        us = integrations.normalize_urlscan({'success': True, 'data': {'total': 0}})
        self.assertEqual(us['verdict'], 'unknown')
        vt = integrations.normalize_virustotal({'success': True, 'data': {'data': {'attributes': {'last_analysis_stats': {}}}}})
        self.assertEqual(vt['verdict'], 'unknown')
        found = integrations.normalize_urlscan({'success': True, 'data': {'total': 5, 'results': [{}]}})
        self.assertEqual(found['verdict'], 'unknown')

    def test_warning_excludes_healthy_employees_and_soc(self):
        notification_service.queue_education()
        soc_email = f'soc.{uuid.uuid4().hex}@demo.test'
        auth_service.create_account(email=soc_email, password=self.password, role='soc', division='IT')
        database.adjust_points(soc_email, 'IT', -60)
        database.adjust_points(self.email, 'IT', -40)  # exactly 60
        notification_service.queue_education()
        with closing(database.get_connection()) as conn:
            count = conn.execute('SELECT COUNT(*) FROM notification_outbox WHERE recipient IN (?,?)', (self.email, soc_email)).fetchone()[0]
        self.assertEqual(count, 0)


if __name__ == '__main__':
    unittest.main()
