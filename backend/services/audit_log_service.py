"""One chronological list of the decisions people made, gathered from the places that record them.

Nothing new is stored: incident history, access-request answers, education warnings and proxy block/allow
decisions already keep their own audit rows. This module only reads and merges them. The proxy audit lives
in a separate database, so if it cannot be reached the other sources are still returned."""
import logging
from contextlib import closing

import database

log = logging.getLogger(__name__)
KINDS = ('incident', 'access', 'warning', 'proxy')


def _stamp(value) -> str:
    """Normalise SQLite ('2026-10-05 08:00:00') and Postgres/ISO timestamps so they sort together."""
    text = str(value or '').replace(' ', 'T')
    return text[:19] + 'Z' if text else ''


def _incident_rows(conn, limit):
    rows = conn.execute('SELECT id, ticket_id, actor_email, actor_role, event, note, created_at FROM incident_events ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [{'id': f'incident-{r["id"]}', 'at': _stamp(r['created_at']), 'kind': 'incident', 'event': r['event'], 'actor': r['actor_email'],
             'actor_role': r['actor_role'], 'subject': r['ticket_id'], 'detail': r['note'] or ''} for r in rows]


def _access_rows(conn, limit):
    rows = conn.execute("SELECT id, domain, status, decision_note, decided_by, decided_at FROM access_requests WHERE status != 'open' ORDER BY decided_at DESC LIMIT ?", (limit,)).fetchall()
    return [{'id': f'access-{r["id"]}', 'at': _stamp(r['decided_at']), 'kind': 'access', 'event': r['status'], 'actor': r['decided_by'] or '',
             'actor_role': 'soc', 'subject': r['domain'], 'detail': r['decision_note'] or ''} for r in rows]


def _warning_rows(conn, limit):
    rows = conn.execute('SELECT id, actor_email, actor_role, recipient, score, reason, created_at FROM notification_audit ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [{'id': f'warning-{r["id"]}', 'at': _stamp(r['created_at']), 'kind': 'warning', 'event': 'sent', 'actor': r['actor_email'],
             'actor_role': r['actor_role'], 'subject': r['recipient'], 'detail': r['reason'] or ''} for r in rows]


def _proxy_rows(limit):
    try:
        from services import proxy_service
        rows = proxy_service.list_audit(limit)
    except Exception as exc:  # the proxy database is separate; a missing one must not hide the rest
        log.warning('Proxy audit not available for the audit log: %s', exc)
        return []
    return [{'id': f'proxy-{r.get("id")}', 'at': _stamp(r.get('created_at')), 'kind': 'proxy', 'event': str(r.get('action') or ''),
             'actor': r.get('actor_email') or '', 'actor_role': r.get('actor_role') or '', 'subject': r.get('domain') or '',
             'detail': r.get('reason') or ''} for r in rows]


def list_events(limit: int = 100, kind: str | None = None) -> list[dict]:
    if kind is not None and kind not in KINDS:
        raise ValueError('Unknown kind.')
    wanted = (kind,) if kind else KINDS
    events: list[dict] = []
    with closing(database.get_connection()) as conn:
        if 'incident' in wanted:
            events += _incident_rows(conn, limit)
        if 'access' in wanted:
            events += _access_rows(conn, limit)
        if 'warning' in wanted:
            events += _warning_rows(conn, limit)
    if 'proxy' in wanted:
        events += _proxy_rows(limit)
    events.sort(key=lambda e: (e['at'], e['id']), reverse=True)
    return events[:limit]
