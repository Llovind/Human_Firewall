import os
import requests
from datetime import datetime

import database


def generate_ticket():

    now = datetime.now()

    prefix = now.strftime("HF-%Y%m%d")

    total = database.get_incident_count_today() + 1

    return f"{prefix}-{total:06d}"


def create_incident(indicator, analysis):

    ticket = generate_ticket()

    database.insert_incident(

        ticket_id=ticket,

        source_type="proxy",

        reported_url=indicator,

        severity=analysis["severity"],

        vt_verdict=analysis["verdict"],

        urlscan_verdict="",

        screenshot_url="",

        checklist="",

        file_hash="",

        original_filename=""

    )

    return ticket


def send_to_n8n(ticket_id, indicator, analysis):

    webhook = os.getenv("N8N_INCIDENT_WEBHOOK")

    if not webhook:

        print("[N8N] webhook belum dikonfigurasi.")

        return False

    payload = {

        "ticket_id": ticket_id,

        "indicator": indicator,

        "verdict": analysis["verdict"],

        "severity": analysis["severity"],

        "confidence": analysis["confidence"],

        "providers": analysis["providers"],

        "recommendation": analysis["recommendation"],

        "timestamp": datetime.utcnow().isoformat()

    }

    try:

        r = requests.post(

            webhook,

            json=payload,

            timeout=10

        )

        print(

            "[N8N]",

            r.status_code,

            r.text

        )

        return r.ok

    except Exception as e:

        print("[N8N ERROR]", e)

        return False