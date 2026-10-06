"""Weekly snapshots feed the CISO trend: one row per week, refreshed in place, readable by staff only."""
import unittest
import uuid
from datetime import date

import test_technical_debt  # noqa: F401  (sets the same safe test environment as the other suites)
from test_technical_debt import login
from app import app
import database
from services import auth_service


def make_account(role):
    email = uuid.uuid4().hex + '@demo.test'
    password = 'WeeklyTrendTesting2026!'
    auth_service.create_account(email=email, password=password, role=role, division='IT')
    return {'X-Afferent-Session': login(email, password)}


class WeeklyTrends(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_staff_read_and_employee_is_refused(self):
        for role in ('soc', 'grc', 'ciso'):
            response = self.client.get('/api/admin/trends', headers=make_account(role))
            self.assertEqual(response.status_code, 200, role)
            self.assertGreaterEqual(len(response.get_json()['weeks']), 1)
        self.assertEqual(self.client.get('/api/admin/trends', headers=make_account('employee')).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/trends').status_code, 401)

    def test_one_row_per_week_and_oldest_first(self):
        database.record_weekly_snapshot(date(2031, 3, 5))   # a Wednesday
        database.record_weekly_snapshot(date(2031, 3, 7))   # same week: updates, never duplicates
        database.record_weekly_snapshot(date(2031, 3, 12))  # next week
        rows = [w for w in database.list_weekly_snapshots(500) if w['week_start'].startswith('2031-03')]
        self.assertEqual([w['week_start'] for w in rows], ['2031-03-03', '2031-03-10'])

    def test_bad_weeks_value(self):
        self.assertEqual(self.client.get('/api/admin/trends?weeks=abc', headers=make_account('ciso')).status_code, 400)
        self.assertEqual(self.client.get('/api/admin/trends?weeks=1', headers=make_account('ciso')).status_code, 200)


if __name__ == '__main__':
    unittest.main()
