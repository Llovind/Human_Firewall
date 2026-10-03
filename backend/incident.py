"""Persist legacy simulation/report tickets directly; no HTTP loop or n8n."""
import uuid
import database


def generate_ticket():
    return f'INC-{uuid.uuid4().hex[:8].upper()}'


def create_incident(indicator, analysis):
    ticket = generate_ticket()
    severity = analysis.get('severity', 'medium')
    if severity not in database.VALID_SEVERITIES:
        severity = 'medium'
    database.create_incident(ticket_id=ticket, source_type='real_world_report',
                             divisi='Security Operations', severity=severity,
                             reported_url=indicator, vt_verdict=analysis.get('verdict', 'unknown'), urlscan_verdict='')
    return ticket
