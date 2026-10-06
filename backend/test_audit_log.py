"""The audit log merges incident history, access answers, warnings and proxy decisions, newest first, for staff only."""
import unittest
import uuid
from unittest.mock import patch

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
from test_technical_debt import login
from app import app
import database
from services import audit_log_service, auth_service


def make_account(role):
    email = uuid.uuid4().hex + '@demo.test'
    password = 'AuditLogTesting2026!'
    auth_service.create_account(email=email, password=password, role=role, division='IT')
    return email, {'X-Afferent-Session': login(email, password)}


class AuditLog(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_staff_only(self):
        for role in ('soc', 'grc', 'ciso'):
            self.assertEqual(self.client.get('/api/admin/audit-log', headers=make_account(role)[1]).status_code, 200, role)
        self.assertEqual(self.client.get('/api/admin/audit-log', headers=make_account('employee')[1]).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/audit-log').status_code, 401)

    def test_incident_decisions_appear_with_actor_and_reason(self):
        soc_email, headers = make_account('soc')
        ticket = 'INC-' + uuid.uuid4().hex[:8].upper()
        database.create_incident(ticket_id=ticket, source_type='real_world_report', divisi='IT', severity='low')
        self.assertEqual(self.client.patch(f'/api/incidents/{ticket}', json={'status': 'closed', 'note': 'Confirmed harmless.'}, headers=headers).status_code, 200)
        events = audit_log_service.list_events(300)
        mine = [e for e in events if e['subject'] == ticket]
        self.assertEqual(len(mine), 1)
        self.assertEqual((mine[0]['kind'], mine[0]['event'], mine[0]['actor'], mine[0]['detail']), ('incident', 'resolved', soc_email, 'Confirmed harmless.'))

    def test_filter_limit_and_validation(self):
        headers = make_account('ciso')[1]
        self.assertEqual(self.client.get('/api/admin/audit-log?kind=bogus', headers=headers).status_code, 400)
        self.assertEqual(self.client.get('/api/admin/audit-log?limit=abc', headers=headers).status_code, 400)
        body = self.client.get('/api/admin/audit-log?kind=incident&limit=1', headers=headers).get_json()
        self.assertLessEqual(len(body['events']), 1)
        self.assertTrue(all(e['kind'] == 'incident' for e in body['events']))

    def test_proxy_rows_are_merged_and_a_proxy_outage_hides_nothing(self):
        row = {'id': 7, 'action': 'block', 'actor_email': 'a@b.test', 'actor_role': 'soc', 'domain': 'bad.example', 'reason': 'Phishing kit', 'created_at': '2099-01-01T00:00:00+00:00'}
        with patch('services.proxy_service.list_audit', return_value=[row]):
            events = audit_log_service.list_events(300)
        self.assertEqual(events[0]['id'], 'proxy-7')
        self.assertEqual(events[0]['at'], '2099-01-01T00:00:00Z')
        with patch('services.proxy_service.list_audit', side_effect=RuntimeError('proxy database down')):
            self.assertIsInstance(audit_log_service.list_events(300), list)


if __name__ == '__main__':
    unittest.main()
