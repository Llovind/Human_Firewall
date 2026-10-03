"""Daf's review regressions. Temporary DB, mocked providers, no user data."""
import json
import os
import sqlite3
import unittest
import uuid
from contextlib import closing
from unittest.mock import Mock, patch

from test_technical_debt import login  # establishes the isolated test DB/env
import database
import integrations
from app import app
from services import auth_service, domain_scanner, notification_service, proxy_service, report_service


class ReviewChecks(unittest.TestCase):
    def setUp(self):
        self.email = f'review.{uuid.uuid4().hex}@demo.test'
        self.password = 'ReviewTestingPassword2026!'
        self.account = auth_service.create_account(email=self.email, password=self.password, role='employee', division='IT')
        self.employee_headers = {'X-Afferent-Session': login(self.email, self.password)}
        self.client = app.test_client()

    def role_headers(self, role):
        email = f'{role}.{uuid.uuid4().hex}@demo.test'
        auth_service.create_account(email=email, password=self.password, role=role, division='IT')
        return {'X-Afferent-Session': login(email, self.password)}

    def test_snapshot_stable_and_no_fabricated_enforcement(self):
        first = database.get_ai_threat_summaries()
        self.assertEqual(first, database.get_ai_threat_summaries())
        self.assertNotIn('successfully mitigated', json.dumps(first))
        self.assertNotIn('INC-001', first[0]['relatedIncidents'])
        history = database.get_leaderboard()['individual']
        self.assertTrue(all('updated_at' in row for row in history))

    def test_manual_warning_rbac_baseline_cooldown_audit_and_recovery(self):
        account_id = self.account['id']
        path = '/api/admin/security-inbox/warnings'
        body = {'accountId': account_id, 'reason': 'Lanjutkan training keamanan', 'role': 'soc', 'email': 'spoof@demo.test'}
        self.assertEqual(self.client.post(path, json=body).status_code, 401)
        self.assertEqual(self.client.post(path, json=body, headers=self.employee_headers).status_code, 403)
        for role in ('soc', 'grc'):
            headers = self.role_headers(role)
            self.assertEqual(self.client.post(path, json=body, headers=headers).status_code, 400)
            # Inspect read authorization without querying a real PostgreSQL.
            with patch.object(notification_service, 'security_inbox', return_value={'employees': []}):
                self.assertEqual(self.client.get('/api/admin/security-inbox', headers=headers).status_code, 200)
        headers = self.role_headers('grc')
        database.adjust_points(self.email, 'IT', -41)  # 59/200
        response = self.client.post(path, json=body, headers=headers)
        self.assertEqual(response.status_code, 202, response.get_json())
        self.assertEqual(self.client.post(path, json=body, headers=headers).status_code, 400)
        with closing(database.get_connection()) as conn:
            audit = conn.execute('SELECT * FROM notification_audit WHERE recipient=?', (self.email,)).fetchone()
            self.assertEqual(audit['actor_role'], 'grc')
            self.assertEqual(audit['score'], 59)
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute('UPDATE notification_audit SET score=200 WHERE id=?', (audit['id'],))
        database.adjust_points(self.email, 'IT', 1)  # recovered to exactly 60
        with patch.object(notification_service.EmailService, 'send') as send:
            while notification_service.deliver_one():
                pass
            self.assertFalse(any(call.kwargs['to_address'] == self.email for call in send.call_args_list))

    def test_urlscan_result_not_search_hit_and_fixed_origin(self):
        scan_id = str(uuid.uuid4())
        search = Mock(status_code=200)
        search.json.return_value = {'total': 1, 'results': [{'_id': scan_id, 'result': 'http://127.0.0.1/private'}]}
        result = Mock(status_code=200)
        result.json.return_value = {'verdicts': {'overall': {'malicious': True, 'score': 100}}}
        with patch.object(integrations, 'URLSCAN_API_KEY', 'fixture'), patch.object(integrations.requests, 'get', side_effect=[search, result]) as get:
            output = integrations.scan_urlscan('https://report.example.test/path')
            self.assertEqual(get.call_args.args[0], f'https://urlscan.io/api/v1/result/{scan_id}/')
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
            self.assertEqual(integrations.normalize_urlscan(output)['verdict'], 'malicious')
        self.assertEqual(integrations.normalize_urlscan({'success': True, 'data': {'total': 100}})['verdict'], 'unknown')
        self.assertEqual(integrations.normalize_urlscan({'success': True, 'data': {'verdicts': {'overall': {'malicious': False, 'score': 0}}}})['verdict'], 'unknown')
        vt = {'success': True, 'data': {'data': {'attributes': {'last_analysis_stats': {'undetected': 90}}}}}
        self.assertEqual(integrations.normalize_virustotal(vt)['verdict'], 'unknown')

    def test_provider_failure_still_accepts_report_for_soc(self):
        redis = Mock()
        redis.lock.return_value.acquire.return_value = True
        redis.incr.return_value = 1
        alert = {'id': str(uuid.uuid4()), 'status': 'open'}
        with patch.object(report_service.proxy_store, 'redis_client', return_value=redis), \
             patch.object(report_service.proxy_store, 'create_alert', return_value=alert) as create, \
             patch.object(report_service.proxy_store, 'get_alert', return_value=alert), \
             patch.object(integrations, 'scan_virustotal', return_value={'success': False, 'provider': 'virustotal', 'status_code': 429}), \
             patch.object(integrations, 'scan_urlscan', side_effect=ValueError('bad JSON')):
            result = self.client.post('/api/reports', json={'url': 'https://no-record.example.test/'}, headers=self.employee_headers)
        self.assertEqual(result.status_code, 201, result.get_json())
        report = result.get_json()['report']
        self.assertEqual(report['verdict'], 'unknown')
        self.assertEqual(report['analysis']['providerStatus']['virustotal']['state'], 'rate_limited')
        self.assertEqual(report['analysis']['providerStatus']['urlscan']['state'], 'unavailable')
        self.assertEqual(create.call_args.args[0]['source'], 'employee_report')
        self.assertEqual(create.call_args.args[0]['urgency'], 'Unknown')

    def test_generated_hostname_abstains_and_old_model_does_not_enforce(self):
        hostname = '5z-2b6b7616f94640c2840d1841e1ac24c3.ecs.us-east-1.on.aws'
        self.assertEqual(domain_scanner.scan(hostname)['verdict'], 'unknown')
        # Low-FP candidate also handles the observed Microsoft regression.
        self.assertNotEqual(domain_scanner.scan('microsoft.com')['verdict'], 'malicious')
        old = {'source': 'ml', 'decision': 'block', 'model_version': 'old', 'reason': 'Old prediction'}
        with patch.dict(os.environ, {'ML_SCANNER_URL': '', 'ML_LOCAL_ENABLED': 'true'}), \
             patch.object(proxy_service.proxy_store, 'get_cached_verdict', return_value=old), \
             patch.object(proxy_service.proxy_store, 'enforcement_verdicts', return_value={'example.com': old}):
            self.assertIsNone(proxy_service._effective_verdict('example.com'))
            self.assertEqual(proxy_service.enforcement_decisions(['example.com']), {'example.com': 'allow'})
        soc = {'source': 'soc', 'decision': 'block', 'reason': 'Explicit SOC block'}
        with patch.object(proxy_service.proxy_store, 'get_cached_verdict', return_value=soc):
            self.assertEqual(proxy_service._effective_verdict(hostname)['decision'], 'block')


if __name__ == '__main__':
    unittest.main(verbosity=2)
