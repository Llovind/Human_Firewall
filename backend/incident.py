import os
import requests
import uuid
from datetime import datetime

import database


def generate_ticket():
    return f"INC-{uuid.uuid4().hex[:8].upper()}"


def create_incident(indicator, analysis):
    # Make a POST request to Flask local API endpoint so it handles SQLite insertion and Next.js Dashboard sync automatically
    service_api_key = os.getenv("SERVICE_API_KEY")
    
    # Fallback check for docker internal network vs local dev host
    urls = ['http://flask_api:5000', 'http://localhost:5000']
    base_url = None
    for url in urls:
        try:
            r = requests.get(f"{url}/health", timeout=1)
            base_url = url
            break
        except requests.exceptions.RequestException:
            continue
    if not base_url:
        base_url = 'http://flask_api:5000'
        
    headers = {
        "Content-Type": "application/json"
    }
    if service_api_key:
        headers["Authorization"] = f"Bearer {service_api_key}"
        
    payload = {
        "source_type": "adaptive_gateway",
        "divisi": "Security Team",  # default for proxy-blocked incidents
        "severity": analysis.get("severity", "medium"),
        "reported_url": indicator,
        "vt_verdict": analysis.get("verdict", "suspicious"),
        "urlscan_verdict": "",
        "screenshot_url": "",
        "checklist": "Automatic block by Adaptive Security Gateway proxy simulation.",
        "file_hash": "",
        "original_filename": ""
    }
    
    try:
        res = requests.post(f"{base_url}/api/incidents", json=payload, headers=headers, timeout=5)
        if res.ok:
            data = res.json()
            return data.get("ticket_id")
    except Exception as e:
        print(f"[Incident Creation] Failed to post incident to local Flask API: {e}")
        
    # Fallback to local database insertion if API call fails
    ticket = generate_ticket()
    try:
        database.insert_incident(
            ticket_id=ticket,
            source_type="adaptive_gateway",
            reported_url=indicator,
            severity=analysis.get("severity", "medium"),
            vt_verdict=analysis.get("verdict", "suspicious"),
            urlscan_verdict="",
            screenshot_url="",
            checklist="Automatic block by Adaptive Security Gateway proxy simulation (Database fallback).",
            file_hash="",
            original_filename=""
        )
        return ticket
    except Exception as db_err:
        print(f"[Incident Creation] Fallback DB insert failed: {db_err}")
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