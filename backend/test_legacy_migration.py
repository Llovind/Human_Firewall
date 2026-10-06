"""An existing database from before this release is upgraded in place and keeps its data.

The legacy file is built by hand with the old table layouts: no explanation or English columns on the quiz,
no language on accounts, no incident owner, no history tables."""
import os
import sqlite3
import tempfile
import unittest

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
import database
from quiz_content_en import QUIZ_EN
from quiz_explanations import EXPLANATIONS

FIRST_ID = next(iter(EXPLANATIONS))  # first 80 characters of a seeded Indonesian question


class LegacyMigration(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 'legacy.db')
        con = sqlite3.connect(self.path)
        con.executescript('''
            CREATE TABLE quiz_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, question_text TEXT NOT NULL, options TEXT NOT NULL,
                correct_answer_index INTEGER NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL);
            CREATE TABLE employee_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee'
                    CHECK (role IN ('employee', 'phishing_admin', 'soc', 'grc', 'ciso')),
                is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                password_changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TIMESTAMP);
            CREATE TABLE incidents (ticket_id TEXT PRIMARY KEY, source_type TEXT NOT NULL, reported_url TEXT, divisi TEXT,
                severity TEXT NOT NULL DEFAULT 'low', vt_verdict TEXT, urlscan_verdict TEXT, screenshot_url TEXT, checklist TEXT,
                file_hash TEXT, original_filename TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                closed_at TEXT);
        ''')
        question = next(q for q in QUIZ_EN)  # same key as the explanation lookup
        con.execute("INSERT INTO quiz_questions (question_text, options, correct_answer_index, category, difficulty) VALUES (?, ?, 1, 'phishing', 'easy')",
                    (question + ' (padded so the first 80 characters still match)'[:0], '["a","b","c","d"]'))
        con.execute("INSERT INTO quiz_questions (question_text, options, correct_answer_index, category, difficulty) VALUES ('Pertanyaan buatan sendiri?', '[\"x\",\"y\"]', 0, 'custom', 'easy')")
        con.execute("INSERT INTO employee_accounts (email, password_hash, role) VALUES ('old.user@demo.test', 'hash', 'soc')")
        con.execute("INSERT INTO incidents (ticket_id, source_type, severity) VALUES ('INC-OLD00001', 'real_world_report', 'high')")
        con.commit(); con.close()
        self.original = database.DB_PATH
        database.DB_PATH = self.path

    def tearDown(self):
        database.DB_PATH = self.original
        self.dir.cleanup()

    def columns(self, table):
        con = sqlite3.connect(self.path)
        try:
            return [row[1] for row in con.execute(f'PRAGMA table_info({table})')]
        finally:
            con.close()

    def test_old_database_is_upgraded_and_keeps_its_rows(self):
        database.init_db()
        self.assertTrue({'explanation', 'question_text_en', 'options_en', 'explanation_en'} <= set(self.columns('quiz_questions')))
        self.assertIn('language', self.columns('employee_accounts'))
        self.assertIn('assigned_to', self.columns('incidents'))
        con = sqlite3.connect(self.path)
        try:
            self.assertEqual(con.execute("SELECT role, language FROM employee_accounts WHERE email = 'old.user@demo.test'").fetchone(), ('soc', None))
            self.assertEqual(con.execute("SELECT severity, assigned_to FROM incidents WHERE ticket_id = 'INC-OLD00001'").fetchone(), ('high', None))
            names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        finally:
            con.close()
        self.assertTrue({'incident_events', 'weekly_snapshots', 'access_requests'} <= names)
        con = sqlite3.connect(self.path)
        try:
            seeded = con.execute('SELECT explanation, question_text_en, options_en, explanation_en FROM quiz_questions WHERE category = ?', ('phishing',)).fetchone()
        finally:
            con.close()
        self.assertTrue(all(seeded), 'the old seeded question gets its explanation and English text')

    def test_english_is_served_for_upgraded_questions(self):
        database.init_db()
        con = sqlite3.connect(self.path)
        con.execute("DELETE FROM quiz_questions WHERE category = 'custom'"); con.commit(); con.close()
        english = database.get_daily_question('old.user@demo.test', 'en')
        indonesian = database.get_daily_question('old.user@demo.test', 'id')
        self.assertEqual((english['language'], indonesian['language']), ('en', 'id'))
        self.assertNotEqual(english['question_text'], indonesian['question_text'])
        self.assertEqual(len(english['options']), len(indonesian['options']))
        self.assertEqual(english['correct_answer_index'], indonesian['correct_answer_index'])
        self.assertTrue(english['explanation'] and english['explanation'] != indonesian['explanation'])
        self.assertEqual(database.get_daily_question('old.user@demo.test', 'fr')['language'], 'id')

    def test_custom_questions_are_untouched_and_the_upgrade_is_repeatable(self):
        database.init_db()
        database.init_db()
        con = sqlite3.connect(self.path)
        try:
            custom = con.execute("SELECT question_text, explanation, question_text_en FROM quiz_questions WHERE category = 'custom'").fetchone()
            count = con.execute('SELECT COUNT(*) FROM quiz_questions').fetchone()[0]
        finally:
            con.close()
        self.assertEqual(custom, ('Pertanyaan buatan sendiri?', None, None))
        self.assertEqual(count, 2)  # an existing quiz table is never re-seeded

    def test_legacy_question_without_english_is_served_in_indonesian(self):
        database.init_db()
        question = database.get_daily_question('old.user@demo.test', 'en')
        self.assertIsNotNone(question)
        self.assertEqual(question['language'], 'id')


if __name__ == '__main__':
    unittest.main()
