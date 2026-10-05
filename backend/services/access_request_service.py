"""Employee requests to open a blocked site.

Deliberately separate from /api/reports: a request is not a threat report, so it runs no scan,
earns no reward and creates no proxy alert. The employee gives a reason; SOC answers.

SOC has exactly two outcomes, because the proxy only supports domain-wide rules:
  * allow: the domain is allowed for everyone (recorded in the proxy audit trail), or
  * deny: the block stays.
"""
import uuid
from contextlib import closing

import database
from services import proxy_service
from services.report_service import rate_limit

OPEN, ALLOWED, DENIED = 'open', 'allowed', 'denied'
MIN_TEXT, MAX_REASON, MAX_NOTE = 5, 1000, 1000


def _clean_text(value, label, maximum):
    text = value.strip() if isinstance(value, str) else ''
    if len(text) < MIN_TEXT:
        raise ValueError(f'{label} must be at least {MIN_TEXT} characters.')
    if len(text) > maximum:
        raise ValueError(f'{label} must be at most {maximum} characters.')
    return text


def _domain(target):
    try:
        return proxy_service.normalize_policy_domain(target if isinstance(target, str) else '')
    except proxy_service.ProxyError as exc:
        raise ValueError('Enter the website address that was blocked.') from exc


def _employee_view(row):
    # Employees see the outcome and the SOC note, never who decided.
    return {key: row[key] for key in ('id', 'domain', 'reason', 'status', 'decision_note', 'decided_at', 'created_at')}


def _staff_view(row):
    result = _employee_view(row)
    result.update(email=row['email'], decided_by=row['decided_by'])
    return result


def submit(identity, target, reason, request_id):
    domain = _domain(target)
    reason = _clean_text(reason, 'Reason', MAX_REASON)
    with closing(database.get_connection()) as conn:
        existing = conn.execute("SELECT * FROM access_requests WHERE account_id=? AND domain=? AND status='open'",
                                (identity.account_id, domain)).fetchone()
    if existing:
        return {'request': _employee_view(existing), 'duplicate': True}
    rate_limit(identity, kind='access')
    new_id = str(uuid.uuid4())
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        # The unique partial index guards two parallel submissions of the same request.
        conn.execute('INSERT OR IGNORE INTO access_requests (id, account_id, email, domain, reason, request_id) VALUES (?, ?, ?, ?, ?, ?)',
                     (new_id, identity.account_id, identity.email, domain, reason, request_id))
        row = conn.execute("SELECT * FROM access_requests WHERE account_id=? AND domain=? AND status='open'",
                           (identity.account_id, domain)).fetchone()
    return {'request': _employee_view(row), 'duplicate': row['id'] != new_id}


def list_mine(identity, limit=50):
    with closing(database.get_connection()) as conn:
        rows = conn.execute('SELECT * FROM access_requests WHERE account_id=? ORDER BY created_at DESC, id LIMIT ?',
                            (identity.account_id, limit)).fetchall()
    return [_employee_view(row) for row in rows]


def list_for_staff(status=None, limit=200):
    if status not in (None, OPEN, ALLOWED, DENIED):
        raise ValueError('Unknown status filter.')
    with closing(database.get_connection()) as conn:
        if status:
            rows = conn.execute('SELECT * FROM access_requests WHERE status=? ORDER BY created_at DESC, id LIMIT ?', (status, limit)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM access_requests ORDER BY created_at DESC, id LIMIT ?', (limit,)).fetchall()
        counts = {r['status']: r['n'] for r in conn.execute('SELECT status, COUNT(*) AS n FROM access_requests GROUP BY status').fetchall()}
    return {'requests': [_staff_view(row) for row in rows],
            'counts': {OPEN: counts.get(OPEN, 0), ALLOWED: counts.get(ALLOWED, 0), DENIED: counts.get(DENIED, 0)}}


def decide(identity, access_request_id, decision, note, http_request_id):
    """SOC only (enforced by the route). 'allow' also writes the proxy policy, with an audit entry."""
    if decision not in ('allow', 'deny'):
        raise ValueError('Decision must be allow or deny.')
    note = _clean_text(note, 'Note', MAX_NOTE)
    with closing(database.get_connection()) as conn:
        row = conn.execute('SELECT * FROM access_requests WHERE id=?', (access_request_id,)).fetchone()
    if not row:
        raise LookupError('Access request not found.')
    if row['status'] != OPEN:
        raise PermissionError('This request was already decided.')
    if decision == 'allow':
        # Policy first: if the proxy refuses (for example a domain that is too broad), the request stays open.
        proxy_service.manual_decision(domain_value=row['domain'], action='allow', reason=note,
                                      identity=identity, request_id=http_request_id)
    new_status = ALLOWED if decision == 'allow' else DENIED
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        cursor = conn.execute("UPDATE access_requests SET status=?, decision_note=?, decided_by=?, decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'",
                              (new_status, note, identity.email, access_request_id))
        if cursor.rowcount != 1:
            raise PermissionError('This request was already decided.')
        updated = conn.execute('SELECT * FROM access_requests WHERE id=?', (access_request_id,)).fetchone()
    return _staff_view(updated)
