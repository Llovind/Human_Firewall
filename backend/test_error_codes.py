"""Report and scan errors carry a stable code the dashboard can translate."""
import unittest

from services.error_codes import code_for, error_body


class ErrorCodes(unittest.TestCase):
    def test_known_phrases_map_to_codes(self):
        cases = {
            'Limit reached: 20 requests per hour. Try again later.': 'RATE_LIMITED',
            'Description must be at most 2000 characters.': 'DESCRIPTION_TOO_LONG',
            'This report is already being processed. Try again shortly.': 'IN_PROGRESS',
            'Confirm that this non-confidential file may be shared with VirusTotal.': 'CONSENT_REQUIRED',
            'Choose a file.': 'FILE_REQUIRED',
            'File must be at most 10 MB.': 'FILE_TOO_LARGE',
            'The file is empty.': 'FILE_EMPTY',
            'File scan queue is full. Try again after pending analyses finish.': 'QUEUE_FULL',
            'URL wajib diisi dan maksimal 4096 karakter': 'INVALID_URL',
        }
        for message, code in cases.items():
            self.assertEqual(code_for(message), code, message)

    def test_unknown_text_has_no_code_and_body_keeps_the_text(self):
        self.assertIsNone(code_for('something new'))
        self.assertEqual(error_body(ValueError('something new')), {'error': 'something new'})
        self.assertEqual(error_body(ValueError('Choose a file.')), {'error': 'Choose a file.', 'code': 'FILE_REQUIRED'})


class ErrorCodesOnEveryRoute(unittest.TestCase):
    """The app adds a code to plain-text JSON errors from any route, and leaves coded errors alone."""

    def setUp(self):
        import uuid
        import test_technical_debt  # noqa: F401  (sets the safe test environment)
        from test_technical_debt import login
        from app import app
        from services import auth_service
        self.client = app.test_client()
        email = uuid.uuid4().hex + '@demo.test'
        auth_service.create_account(email=email, password='ErrorCodesTesting2026!', role='soc', division='IT')
        self.soc = {'X-Afferent-Session': login(email, 'ErrorCodesTesting2026!')}

    def test_uncoded_route_errors_gain_a_code(self):
        missing = self.client.patch('/api/incidents/INC-DOES-NOT-EXIST', json={'status': 'closed', 'note': 'Reason that is long enough.'}, headers=self.soc)
        self.assertEqual((missing.status_code, missing.get_json()['code']), (404, 'NOT_FOUND'))
        empty = self.client.patch('/api/incidents/INC-X', json={}, headers=self.soc)
        self.assertEqual((empty.status_code, empty.get_json()['code']), (400, 'INVALID_PAYLOAD'))
        short = self.client.post('/api/admin/access-requests/00000000-0000-0000-0000-000000000000/decision', json={'decision': 'allow', 'note': 'x'}, headers=self.soc)
        self.assertEqual((short.status_code, short.get_json()['code']), (400, 'TEXT_TOO_SHORT'))

    def test_existing_codes_and_success_responses_are_untouched(self):
        denied = self.client.get('/api/admin/trends')
        self.assertEqual(denied.get_json()['code'], 'UNAUTHORIZED')
        self.assertNotIn('code', self.client.get('/api/admin/trends', headers=self.soc).get_json())


if __name__ == '__main__':
    unittest.main()
