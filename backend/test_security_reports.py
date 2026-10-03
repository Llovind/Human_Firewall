"""Private file scan/report/LLM regressions: no real provider request or policy write."""
import hashlib
import io
import json
import os
import unittest
import uuid
from contextlib import closing
from unittest.mock import Mock, patch

from test_technical_debt import login
from app import app
import database
import integrations
from services import auth_service, local_llm_service, notification_service, proxy_store, report_service


class SecurityReports(unittest.TestCase):
    def setUp(self):
        self.email = uuid.uuid4().hex + '@demo.test'
        self.password = 'ReportsTestingPassword2026!'
        self.account = auth_service.create_account(email=self.email, password=self.password, role='employee', division='IT')
        self.headers = {'X-Afferent-Session': login(self.email, self.password)}
        self.client = app.test_client()
        self.redis = Mock()
        self.redis.incr.return_value = 1
        self.redis.lock.return_value.acquire.return_value = True
        for target in ('redis_client', 'publish_alert'):
            patcher = patch.object(proxy_store, target, return_value=self.redis if target == 'redis_client' else None)
            mock = patcher.start()
            if target == 'publish_alert':
                self.soc_events = mock
            self.addCleanup(patcher.stop)
        # Jobs from another check must not steal this test's worker iteration.
        with closing(database.get_connection()) as conn, conn:
            conn.execute('UPDATE file_analysis_jobs SET done=1,payload=NULL')
            conn.execute("UPDATE local_llm_reviews SET status='completed'")

    def upload(self, payload=b'%PDF-1.7\nHarmless synthetic test fixture\n%%EOF', name='report.pdf', consent='true', headers=None):
        return self.client.post('/api/threat/file-scan', data={'file': (io.BytesIO(payload), name), 'consent': consent},
            headers=self.headers if headers is None else headers)

    def job(self, scan_id):
        with closing(database.get_connection()) as conn:
            return dict(conn.execute('SELECT * FROM file_analysis_jobs WHERE scan_id=?', (scan_id,)).fetchone())

    def test_file_validation_auth_and_size(self):
        self.assertEqual(self.upload(headers={}).status_code, 401)
        for consent, name, data in [('false', 'report.pdf', b'%PDF-1.7'), ('true', '', b'fixture'), ('true', 'empty.txt', b'')]:
            self.assertEqual(self.upload(data, name, consent).status_code, 400)
        with patch.dict(os.environ, {'FILE_SCAN_MAX_MB': '1'}):
            self.assertEqual(self.upload(b'%PDF-1.7\n' + b'x' * (1024 * 1024 + 65536)).status_code, 413)
        self.redis.incr.return_value = 21
        self.assertEqual(self.upload().status_code, 400)

    def test_file_owned_deduped_no_soc_report_event_policy_or_rewards(self):
        payload = b'%PDF-1.7\nsynthetic-' + self.email.encode()
        before = database.get_user_history(self.email)['points']
        response = self.upload(payload, '../test.pdf')
        self.assertEqual(response.status_code, 202, response.get_json())
        report = response.get_json()['scan']
        self.assertEqual(report['file_sha256'], hashlib.sha256(payload).hexdigest())
        self.assertEqual(report['file_name'], 'test.pdf')
        self.assertEqual(report['status'], 'pending')
        self.assertNotIn('payload', report)
        duplicate = self.upload(payload, 'renamed.pdf')
        self.assertTrue(duplicate.get_json()['duplicate'])
        self.assertEqual(database.get_user_history(self.email)['points'], before)
        identity = auth_service.get_identity(self.headers['X-Afferent-Session'])
        self.assertEqual(self.client.get('/api/threat/file-scan', headers=self.headers).headers.get('Cache-Control'), 'private, no-store')
        self.assertEqual(len(report_service.list_file_scans(identity)), 1)
        self.assertEqual(report_service.list_reports(identity), [])
        self.assertEqual(notification_service.security_inbox()['reports'], [])
        self.soc_events.assert_not_called()
        with closing(database.get_connection()) as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM employee_url_reports WHERE account_id=?', (identity.account_id,)).fetchone()[0], 0)
        other = uuid.uuid4().hex + '@demo.test'
        auth_service.create_account(email=other, password=self.password, role='employee', division='IT')
        other_headers = {'X-Afferent-Session': login(other, self.password)}
        self.assertEqual(self.client.get('/api/threat/file-scan', headers=other_headers).get_json()['scans'], [])
        soc = uuid.uuid4().hex + '@demo.test'
        auth_service.create_account(email=soc, password=self.password, role='soc', division='IT')
        soc_headers = {'X-Afferent-Session': login(soc, self.password)}
        self.assertEqual(self.client.get('/api/threat/file-scan', headers=soc_headers).status_code, 403)
        self.assertEqual(self.upload(headers=soc_headers).status_code, 403)

    def test_non_pdf_formats_are_opaque_and_sent_as_generic_binary(self):
        for name, payload in [('example.txt', b'text fixture'), ('example.png', b'\x89PNG fixture'),
                              ('example.zip', b'PK fixture'), ('example.exe', b'MZ fixture')]:
            response = self.upload(payload, name)
            self.assertEqual(response.status_code, 202, response.get_json())
        with patch.object(integrations, 'vt_file_request', return_value={}) as provider:
            integrations.upload_vt_file(b'MZ fixture')
            self.assertEqual(provider.call_args.kwargs['files']['file'], ('sample.bin', b'MZ fixture', 'application/octet-stream'))
        self.soc_events.assert_not_called()

    def test_legacy_pdf_migration_preserves_history_and_pending_job_once(self):
        identity = auth_service.get_identity(self.headers['X-Afferent-Session'])
        legacy_id, payload = uuid.uuid4().hex, b'%PDF-1.7\nlegacy fixture'
        digest = hashlib.sha256(payload).hexdigest()
        analysis = json.dumps({'verdict': 'unknown', 'providerStatus': {'virustotal': {'state': 'queued'}}})
        with closing(database.get_connection()) as conn, conn:
            conn.execute('''INSERT INTO employee_url_reports
                (id,account_id,email,url,verdict,analysis_json,report_type,file_name,file_sha256,file_size)
                VALUES (?,?,?,?,'unknown',?,'pdf','old.pdf',?,?)''',
                (legacy_id, identity.account_id, self.email, 'sha256:' + digest, analysis, digest, len(payload)))
            conn.execute('''INSERT INTO pdf_analysis_jobs (report_id,payload,expires_at,request_id)
                VALUES (?,?,9999999999,'migration-fixture')''', (legacy_id, payload))
        database.init_db()
        self.assertEqual(self.job(legacy_id)['payload'], payload)
        self.assertEqual(len(report_service.list_file_scans(identity)), 1)
        self.assertEqual(report_service.list_reports(identity), [])
        self.assertEqual(notification_service.security_inbox()['reports'], [])
        with closing(database.get_connection()) as conn, conn:
            self.assertIsNone(conn.execute('SELECT payload FROM pdf_analysis_jobs WHERE report_id=?', (legacy_id,)).fetchone()[0])
            self.assertIsNotNone(conn.execute('SELECT id FROM employee_url_reports WHERE id=?', (legacy_id,)).fetchone())
            conn.execute('UPDATE file_analysis_jobs SET payload=NULL,done=1 WHERE scan_id=?', (legacy_id,))
        database.init_db()
        self.assertIsNone(self.job(legacy_id)['payload'])
        self.assertEqual(self.job(legacy_id)['done'], 1)
        self.assertEqual(len(report_service.list_file_scans(identity)), 1)

    def test_existing_vt_hash_does_not_upload(self):
        report = self.upload().get_json()['scan']
        known = {'success': True, 'provider': 'virustotal', 'status_code': 200,
                 'data': {'data': {'attributes': {'last_analysis_stats': {'malicious': 3, 'undetected': 50}}}}}
        with patch.object(integrations, 'scan_vt_file_hash', return_value=known), \
             patch.object(integrations, 'upload_vt_file') as upload, \
             patch.object(proxy_store, 'upsert_verdict') as policy:
            self.assertTrue(report_service.process_file_one())
            upload.assert_not_called()
            policy.assert_not_called()
        self.assertIsNone(self.job(report['id'])['payload'])
        reports = self.client.get('/api/threat/file-scan', headers=self.headers).get_json()['scans']
        self.assertEqual(reports[0]['verdict'], 'malicious')
        self.assertEqual(reports[0]['status'], 'completed')
        self.soc_events.assert_not_called()
        self.assertEqual(notification_service.security_inbox()['reports'], [])

    def test_new_file_upload_pending_completed_and_bytes_deleted(self):
        report = self.upload().get_json()['scan']
        absent = {'success': False, 'provider': 'virustotal', 'status_code': 404}
        submitted = {'success': True, 'provider': 'virustotal', 'status_code': 200, 'data': {'data': {'id': 'fixture-analysis'}}}
        completed = {'success': True, 'provider': 'virustotal', 'status_code': 200,
            'data': {'data': {'attributes': {'status': 'completed', 'stats': {'malicious': 0, 'undetected': 70}}}}}
        with patch.object(integrations, 'scan_vt_file_hash', return_value=absent), patch.object(integrations, 'upload_vt_file', return_value=submitted):
            report_service.process_file_one()
        self.assertIsNone(self.job(report['id'])['payload'])
        self.assertEqual(self.job(report['id'])['done'], 0)
        with closing(database.get_connection()) as conn, conn:
            conn.execute('UPDATE file_analysis_jobs SET available_at=0 WHERE scan_id=?', (report['id'],))
        with patch.object(integrations, 'poll_vt_analysis', return_value=completed) as poll:
            report_service.process_file_one()
            poll.assert_called_once_with('fixture-analysis')
        self.assertEqual(self.job(report['id'])['done'], 1)
        self.assertEqual(self.client.get('/api/threat/file-scan', headers=self.headers).get_json()['scans'][0]['verdict'], 'clean')
        self.soc_events.assert_not_called()

    def test_upload_failure_is_not_retried_or_falsely_clean(self):
        report = self.upload().get_json()['scan']
        absent = {'success': False, 'provider': 'virustotal', 'status_code': 404}
        failed = {'success': False, 'provider': 'virustotal', 'status_code': 502}
        with patch.object(integrations, 'scan_vt_file_hash', return_value=absent), patch.object(integrations, 'upload_vt_file', return_value=failed) as upload:
            report_service.process_file_one()
            self.assertFalse(report_service.process_file_one())
            upload.assert_called_once()
        self.assertEqual(self.job(report['id'])['done'], 1)
        self.assertIsNone(self.job(report['id'])['payload'])
        self.assertEqual(self.client.get('/api/threat/file-scan', headers=self.headers).get_json()['scans'][0]['verdict'], 'unknown')

    def test_file_scan_expiry_and_local_quota_do_not_claim_safe(self):
        scan = self.upload().get_json()['scan']
        absent = {'success': False, 'provider': 'virustotal', 'status_code': 404}
        limited = {'success': False, 'provider': 'virustotal', 'status_code': 429}
        with patch.object(integrations, 'scan_vt_file_hash', return_value=absent), patch.object(integrations, 'upload_vt_file', return_value=limited):
            report_service.process_file_one()
        self.assertIsNotNone(self.job(scan['id'])['payload'])
        with closing(database.get_connection()) as conn, conn:
            conn.execute('UPDATE file_analysis_jobs SET expires_at=0,available_at=0 WHERE scan_id=?', (scan['id'],))
        report_service.process_file_one()
        self.assertIsNone(self.job(scan['id'])['payload'])
        result = self.client.get('/api/threat/file-scan', headers=self.headers).get_json()['scans'][0]
        self.assertEqual(result['verdict'], 'unknown')
        self.assertEqual(result['status'], 'unknown')
        self.assertEqual(result['analysis']['providerStatus']['virustotal']['state'], 'expired')

    def test_old_pdf_report_endpoint_is_retired(self):
        self.assertEqual(self.client.post('/api/reports/pdf', headers=self.headers).status_code, 410)

    def test_scan_url_uses_providers_without_report_reward_or_model(self):
        vt = {'success': True, 'provider': 'virustotal', 'status_code': 200,
            'data': {'data': {'attributes': {'last_analysis_stats': {'malicious': 2}}}}}
        us = {'success': False, 'provider': 'urlscan', 'status_code': 404}
        before = database.get_user_history(self.email)['points']
        with patch.object(integrations, 'scan_virustotal', return_value=vt) as provider, \
             patch.object(integrations, 'scan_urlscan', return_value=us), \
             patch('services.ml_service.scan') as model, patch.object(proxy_store, 'create_alert') as alert:
            response = self.client.post('/api/threat/scan', json={'url': 'https://' + uuid.uuid4().hex + '.test/'}, headers=self.headers)
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()['data']['verdict'], 'malicious')
            provider.assert_called_once()
            model.assert_not_called()
            alert.assert_not_called()
        self.assertEqual(database.get_user_history(self.email)['points'], before)
        self.assertEqual(self.client.get('/api/reports', headers=self.headers).get_json()['reports'], [])

    def test_llm_only_soc_and_no_enforcement(self):
        path = '/api/proxy/second-opinion'
        self.assertEqual(self.client.post(path, json={'domain': 'example.test'}, headers=self.headers).status_code, 403)
        email = uuid.uuid4().hex + '@demo.test'
        auth_service.create_account(email=email, password=self.password, role='soc', division='IT')
        headers = {'X-Afferent-Session': login(email, self.password)}
        domain = uuid.uuid4().hex + '.test'
        with patch.dict(os.environ, {'LOCAL_LLM_ENABLED': 'true'}), \
             patch.object(local_llm_service, 'analyze', return_value={'assessment': 'suspicious', 'category': 'phishing', 'reason': 'Fixture only', 'confidence': None, 'advisoryOnly': True}), \
             patch.object(proxy_store, 'upsert_verdict') as policy:
            response = self.client.post(path, json={'domain': domain}, headers=headers)
            self.assertEqual(response.status_code, 202, response.get_json())
            self.assertTrue(local_llm_service.process_one())
            review = self.client.get(path + '?domain=' + domain, headers=headers).get_json()
            self.assertEqual(review['status'], 'completed')
            self.assertTrue(review['advisoryOnly'])
            policy.assert_not_called()

    def test_llm_extra_confidence_or_invalid_output_rejected(self):
        response = Mock()
        response.json.return_value = {'message': {'content': json.dumps({'assessment': 'suspicious', 'category': 'phishing', 'reason': 'Fixture', 'confidence': 0.99})}}
        with patch.dict(os.environ, {'LOCAL_LLM_OUTPUT_MODE': 'json'}), patch.object(local_llm_service.requests, 'post', return_value=response) as call:
            with self.assertRaises(ValueError):
                local_llm_service.analyze('example.test')
            self.assertFalse(call.call_args.kwargs['allow_redirects'])

    def test_finetuned_class_token_is_strict_short_and_advisory_only(self):
        response = Mock()
        response.json.return_value = {'message': {'content': 'E'}}
        with patch.dict(os.environ, {'LOCAL_LLM_OUTPUT_MODE': 'class_token'}), patch.object(local_llm_service.requests, 'post', return_value=response) as call:
            result = local_llm_service.analyze('fixture.test')
            self.assertEqual(result['category'], 'gambling')
            self.assertTrue(result['advisoryOnly'])
            self.assertIsNone(result['confidence'])
            self.assertEqual(call.call_args.kwargs['json']['options']['num_predict'], 2)
            self.assertFalse(call.call_args.kwargs['json']['think'])
            response.json.return_value = {'message': {'content': 'E - definitely block this'}}
            with self.assertRaises(ValueError):
                local_llm_service.analyze('fixture.test')


if __name__ == '__main__':
    unittest.main(verbosity=2)
