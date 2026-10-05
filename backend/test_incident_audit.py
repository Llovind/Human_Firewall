"""Incident handling is audited: who resolved, reopened or assigned, when, and why."""
import unittest
import uuid

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
from test_technical_debt import login
from app import app
import database
from services import auth_service


def make_account(role):
    email = uuid.uuid4().hex + '@demo.test'
    password = 'IncidentAuditTesting2026!'
    auth_service.create_account(email=email, password=password, role=role, division='IT')
    return email, {'X-Afferent-Session': login(email, password)}


class IncidentAudit(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.soc_email, self.soc = make_account('soc')
        self.other_soc_email, self.other_soc = make_account('soc')
        _, self.grc = make_account('grc')
        _, self.ciso = make_account('ciso')
        _, self.employee = make_account('employee')
        self.ticket = 'INC-' + uuid.uuid4().hex[:8].upper()
        database.create_incident(ticket_id=self.ticket, source_type='real_world_report', divisi='Finance',
                                 severity='high', reported_url='http://bad.example/login', vt_verdict='malicious')

    def patch(self, body, headers=None, ticket=None):
        return self.client.patch(f'/api/incidents/{ticket or self.ticket}', json=body, headers=headers or self.soc)

    def events(self, headers=None):
        return self.client.get(f'/api/incidents/{self.ticket}/events', headers=headers or self.soc)

    def test_resolving_needs_a_reason_and_records_who_when_and_why(self):
        self.assertEqual(self.patch({'status': 'closed'}).status_code, 400)
        self.assertEqual(self.patch({'status': 'closed', 'note': 'ok'}).status_code, 400)
        response = self.patch({'status': 'closed', 'note': 'Domain blocked and the employee was told.'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['incident']['status'], 'closed')
        event = self.events().get_json()['events'][0]
        self.assertEqual((event['event'], event['actor_email'], event['actor_role']), ('resolved', self.soc_email, 'soc'))
        self.assertEqual(event['note'], 'Domain blocked and the employee was told.')
        self.assertTrue(event['created_at'])

    def test_failed_validation_writes_nothing(self):
        self.patch({'status': 'closed'})
        self.assertEqual(self.events().get_json()['events'], [])
        listing = [i for i in self.client.get('/api/incidents', headers=self.soc).get_json()['incidents'] if i['ticket_id'] == self.ticket]
        self.assertEqual(listing[0]['status'], 'open')

    def test_reopen_records_event_and_clears_closed_time(self):
        self.patch({'status': 'closed', 'note': 'Handled by phone.'})
        response = self.patch({'status': 'open', 'note': 'The employee clicked again.'})
        self.assertEqual(response.status_code, 200)
        incident = response.get_json()['incident']
        self.assertEqual(incident['status'], 'open'); self.assertIsNone(incident['closed_at'])
        self.assertEqual([e['event'] for e in self.events().get_json()['events']], ['reopened', 'resolved'])

    def test_resolving_twice_does_not_duplicate_the_event(self):
        self.patch({'status': 'closed', 'note': 'First resolution.'})
        self.patch({'status': 'closed', 'note': 'Second click.'})
        self.assertEqual(len(self.events().get_json()['events']), 1)

    def test_assign_to_me_and_unassign(self):
        response = self.patch({'assignee': 'me'})
        self.assertEqual(response.get_json()['incident']['assigned_to'], self.soc_email.lower())
        self.patch({'assignee': 'me'}, headers=self.other_soc)
        self.assertEqual(self.client.get('/api/incidents', headers=self.soc).status_code, 200)
        mine = [i for i in self.client.get('/api/incidents', headers=self.soc).get_json()['incidents'] if i['ticket_id'] == self.ticket][0]
        self.assertEqual(mine['assigned_to'], self.other_soc_email.lower())
        self.assertIsNone(self.patch({'assignee': ''}).get_json()['incident']['assigned_to'])
        self.assertEqual([e['event'] for e in self.events().get_json()['events']], ['unassigned', 'assigned', 'assigned'])
        self.assertEqual(self.patch({'assignee': 'someone@else.test'}).status_code, 400)

    def test_assigning_to_the_same_person_is_a_no_op(self):
        self.patch({'assignee': 'me'}); self.patch({'assignee': 'me'})
        self.assertEqual(len(self.events().get_json()['events']), 1)

    def test_validation_and_not_found(self):
        self.assertEqual(self.patch({}).status_code, 400)
        self.assertEqual(self.patch({'status': 'maybe', 'note': 'whatever it is'}).status_code, 400)
        self.assertEqual(self.patch({'status': 'closed', 'note': 'x' * 1001}).status_code, 400)
        self.assertEqual(self.patch({'status': 'closed', 'note': 'Valid reason here'}, ticket='INC-MISSING').status_code, 404)

    def test_roles(self):
        body = {'status': 'closed', 'note': 'Valid reason here'}
        for headers in (self.grc, self.ciso, self.employee):
            self.assertEqual(self.patch(body, headers=headers).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/incidents/{self.ticket}', json=body).status_code, 401)
        self.assertEqual(self.events(headers=self.grc).status_code, 200)
        self.assertEqual(self.events(headers=self.ciso).status_code, 200)
        self.assertEqual(self.events(headers=self.employee).status_code, 403)


if __name__ == '__main__':
    unittest.main()
