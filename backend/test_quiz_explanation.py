"""Every seeded quiz question has a short "why", and an older database without the column is upgraded."""
import unittest

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
import database
from quiz_explanations import EXPLANATIONS


class QuizExplanation(unittest.TestCase):
    def test_every_seeded_question_has_an_explanation(self):
        conn = database.get_connection()
        try:
            rows = conn.execute('SELECT substr(question_text, 1, 80) AS key, explanation FROM quiz_questions').fetchall()
        finally:
            conn.close()
        seeded = [r for r in rows if r['key'] in EXPLANATIONS]
        self.assertEqual(len(seeded), len(EXPLANATIONS))
        self.assertTrue(all(r['explanation'] and len(r['explanation']) > 30 for r in seeded))

    def test_daily_question_carries_the_explanation(self):
        question = database.get_daily_question('someone@demo.test')
        self.assertIsNotNone(question)
        self.assertIn('explanation', question)
        self.assertTrue(question['explanation'])

    def test_every_seeded_question_has_an_english_version_with_matching_options(self):
        conn = database.get_connection()
        try:
            rows = conn.execute('SELECT options, options_en, question_text_en, explanation_en FROM quiz_questions WHERE question_text_en IS NOT NULL').fetchall()
        finally:
            conn.close()
        self.assertEqual(len(rows), 30)
        import json
        for row in rows:
            self.assertEqual(len(json.loads(row['options'])), len(json.loads(row['options_en'])))
            self.assertTrue(row['explanation_en'])

    def test_init_is_safe_to_repeat(self):
        database.init_db()
        database.init_db()
        conn = database.get_connection()
        try:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM quiz_questions WHERE explanation IS NULL').fetchone()[0], 0)
        finally:
            conn.close()


if __name__ == '__main__':
    unittest.main()
