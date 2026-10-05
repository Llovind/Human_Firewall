"""Access requests for blocked sites: separate from threat reports, decided by SOC only."""
import unittest
import uuid
from contextlib import closing
from unittest.mock import Mock, patch

from test_technical_debt import login
from app import app
import database
from services import access_request_service, auth_service, proxy_service, proxy_store


def make_account(role, division='IT'):
    email = uuid.uuid4().hex + '@demo.test'
    password = 'AccessRequestsTesting2026!'
    auth_service.create_account(email=email, password=password, role=role, division=division)
    return email, {'X-Afferent-Session': login(email, password)}


class AccessRequests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.employee_email, self.employee = make_account('employee')
        _, self.other_employee = make_account('employee')
        self.soc_email, self.soc = make_account('soc')
        _, self.grc = make_account('grc')
        self.redis = Mock()
        self.redis.incr.return_value = 1
        for target in ('redis_client', 'publish_alert'):
            patcher = patch.object(proxy_store, target, return_value=self.redis if target == 'redis_client' else None)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.domain = f'supplier-{uuid.uuid4().hex[:8]}.example.com'

    def request_access(self, headers=None, **body):
        payload = {'domain': self.domain, 'reason': 'It is my supplier payment portal.', **body}
        return self.client.post('/api/access-requests', json=payload, headers=headers or self.employee)

    def decide(self, request_id, decision, note='Verified with the supplier.', headers=None):
        return self.client.post(f'/api/admin/access-requests/{request_id}/decision',
                                json={'decision': decision, 'note': note}, headers=headers or self.soc)

    def test_employee_request_is_stored_without_scan_reward_or_alert(self):
        with patch('services.report_service.analyze_url') as scan, patch('database.award_threat_reward') as reward, \
                patch.object(proxy_store, 'create_alert') as alert:
            response = self.request_access()
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertFalse(body['duplicate'])
        self.assertEqual(body['request']['status'], 'open')
        self.assertEqual(body['request']['domain'], self.domain)
        scan.assert_not_called(); reward.assert_not_called(); alert.assert_not_called()

    def test_full_address_is_reduced_to_its_domain(self):
        response = self.request_access(domain=f'https://www.{self.domain}/login?x=1')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()['request']['domain'], self.domain)

    def test_same_open_request_is_returned_not_duplicated(self):
        first = self.request_access().get_json()['request']
        second = self.request_access()
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.get_json()['duplicate'])
        self.assertEqual(second.get_json()['request']['id'], first['id'])
        with closing(database.get_connection()) as conn:
            count = conn.execute('SELECT COUNT(*) FROM access_requests WHERE domain=?', (self.domain,)).fetchone()[0]
        self.assertEqual(count, 1)

    def test_validation(self):
        for body in ({'reason': 'x'}, {'reason': ' ' * 10}, {'reason': 'y' * 1001}, {'domain': ''}, {'domain': 'localhost'}, {'domain': 'com'}):
            self.assertEqual(self.request_access(**body).status_code, 400, body)
        self.assertEqual(self.client.post('/api/access-requests', data='nope', headers=self.employee).status_code, 400)

    def test_employee_sees_only_own_requests_without_decider_identity(self):
        request_id = self.request_access().get_json()['request']['id']
        self.decide(request_id, 'deny', note='Not needed for your role.')
        mine = self.client.get('/api/access-requests', headers=self.employee).get_json()['requests']
        self.assertEqual([r['id'] for r in mine], [request_id])
        self.assertEqual(mine[0]['status'], 'denied')
        self.assertEqual(mine[0]['decision_note'], 'Not needed for your role.')
        self.assertNotIn('decided_by', mine[0]); self.assertNotIn('email', mine[0])
        self.assertEqual(self.client.get('/api/access-requests', headers=self.other_employee).get_json()['requests'], [])

    def test_roles(self):
        request_id = self.request_access().get_json()['request']['id']
        self.assertEqual(self.client.get('/api/admin/access-requests', headers=self.employee).status_code, 403)
        self.assertEqual(self.client.post('/api/access-requests', json={'domain': self.domain, 'reason': 'Please allow it.'}, headers=self.soc).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/access-requests').status_code, 401)
        self.assertEqual(self.client.get('/api/admin/access-requests', headers=self.grc).status_code, 200)
        self.assertEqual(self.decide(request_id, 'allow', headers=self.grc).status_code, 403)
        self.assertEqual(self.decide(request_id, 'allow', headers=self.employee).status_code, 403)

    def test_staff_list_has_counts_and_requester(self):
        self.request_access()
        listing = self.client.get('/api/admin/access-requests?status=open', headers=self.soc).get_json()
        mine = [r for r in listing['requests'] if r['domain'] == self.domain]
        self.assertEqual(mine[0]['email'], self.employee_email)
        self.assertGreaterEqual(listing['counts']['open'], 1)
        self.assertEqual(self.client.get('/api/admin/access-requests?status=bogus', headers=self.soc).status_code, 400)

    def test_allow_writes_policy_and_audit_then_closes_request(self):
        request_id = self.request_access().get_json()['request']['id']
        with patch.object(proxy_service, 'manual_decision', wraps=proxy_service.manual_decision) as policy, \
                patch.object(proxy_store, 'apply_manual_decision', return_value=({}, {'domain': self.domain, 'decision': 'allow'}, None)):
            response = self.decide(request_id, 'allow', note='Verified with the supplier.')
        self.assertEqual(response.status_code, 200)
        policy.assert_called_once()
        kwargs = policy.call_args.kwargs
        self.assertEqual((kwargs['domain_value'], kwargs['action'], kwargs['identity'].role), (self.domain, 'allow', 'soc'))
        body = response.get_json()['request']
        self.assertEqual((body['status'], body['decided_by']), ('allowed', self.soc_email))

    def test_deny_keeps_block_and_writes_no_policy(self):
        request_id = self.request_access().get_json()['request']['id']
        with patch.object(proxy_service, 'manual_decision') as policy:
            response = self.decide(request_id, 'deny', note='Looks like a lookalike domain.')
        self.assertEqual(response.status_code, 200)
        policy.assert_not_called()
        self.assertEqual(response.get_json()['request']['status'], 'denied')

    def test_failed_policy_write_leaves_request_open(self):
        request_id = self.request_access().get_json()['request']['id']
        with patch.object(proxy_service, 'manual_decision', side_effect=proxy_service.ProxyError('INVALID_POLICY_SCOPE', 'Domain policy too broad')):
            response = self.decide(request_id, 'allow')
        self.assertEqual(response.status_code, 400)
        mine = self.client.get('/api/access-requests', headers=self.employee).get_json()['requests']
        self.assertEqual(mine[0]['status'], 'open')

    def test_decision_needs_note_valid_choice_and_cannot_repeat(self):
        request_id = self.request_access().get_json()['request']['id']
        self.assertEqual(self.decide(request_id, 'allow', note='no').status_code, 400)
        self.assertEqual(self.decide(request_id, 'maybe').status_code, 400)
        self.assertEqual(self.decide('missing-id', 'deny').status_code, 404)
        with patch.object(proxy_service, 'manual_decision'):
            self.assertEqual(self.decide(request_id, 'deny').status_code, 200)
            self.assertEqual(self.decide(request_id, 'allow').status_code, 409)

    def test_new_request_allowed_after_previous_one_was_decided(self):
        request_id = self.request_access().get_json()['request']['id']
        self.decide(request_id, 'deny')
        again = self.request_access()
        self.assertEqual(again.status_code, 201)
        self.assertNotEqual(again.get_json()['request']['id'], request_id)

    def test_rate_limit_message_is_a_plain_400(self):
        self.redis.incr.return_value = 21
        response = self.request_access()
        self.assertEqual(response.status_code, 400)
        self.assertIn('Limit reached', response.get_json()['error'])


if __name__ == '__main__':
    unittest.main()
