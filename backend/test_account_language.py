"""A person's language choice is stored on the account and comes back with the session."""
import unittest
import uuid

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
from test_technical_debt import login
from app import app
from services import auth_service


def make_account(role='employee'):
    email = uuid.uuid4().hex + '@demo.test'
    password = 'AccountLanguageTesting2026!'
    auth_service.create_account(email=email, password=password, role=role, division='IT')
    return {'X-Afferent-Session': login(email, password)}


class AccountLanguage(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_default_is_unset_then_saved_then_returned_by_session(self):
        headers = make_account()
        self.assertIsNone(self.client.get('/api/auth/session', headers=headers).get_json()['user']['language'])
        saved = self.client.post('/api/auth/language', json={'language': 'id'}, headers=headers)
        self.assertEqual((saved.status_code, saved.get_json()['language']), (200, 'id'))
        self.assertEqual(self.client.get('/api/auth/session', headers=headers).get_json()['user']['language'], 'id')
        self.client.post('/api/auth/language', json={'language': 'en'}, headers=headers)
        self.assertEqual(self.client.get('/api/auth/session', headers=headers).get_json()['user']['language'], 'en')

    def test_validation_and_session_required(self):
        headers = make_account('soc')
        self.assertEqual(self.client.post('/api/auth/language', json={'language': 'fr'}, headers=headers).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/language', json={}, headers=headers).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/language', data='x', headers=headers).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/language', json={'language': 'id'}).status_code, 401)

    def test_one_account_never_changes_another(self):
        a, b = make_account(), make_account()
        self.client.post('/api/auth/language', json={'language': 'id'}, headers=a)
        self.assertIsNone(self.client.get('/api/auth/session', headers=b).get_json()['user']['language'])


if __name__ == '__main__':
    unittest.main()
