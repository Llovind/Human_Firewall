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


if __name__ == '__main__':
    unittest.main()
