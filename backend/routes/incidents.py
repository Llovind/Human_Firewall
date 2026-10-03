from flask import Blueprint, request, jsonify
import database
import uuid
from security import require_roles

incidents_bp = Blueprint('incidents', __name__)

@incidents_bp.route('/api/incidents', methods=['POST'])
@require_roles('soc', allow_service=True)
def create_incident():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "body JSON wajib diisi"}), 400

    reported_url = data.get('reported_url', '')
    vt_verdict = data.get('vt_verdict', '')
    urlscan_verdict = data.get('urlscan_verdict', '')

    verdict = "clean"
    if vt_verdict == "malicious" or urlscan_verdict == "malicious":
        verdict = "malicious"
    elif vt_verdict == "suspicious" or urlscan_verdict == "suspicious":
        verdict = "suspicious"

    from services.threat_service import reconcile_report_source
    source_verdict = reconcile_report_source(reported_url, verdict)

    if source_verdict == "simulation_correctly_reported":
        source_type = "simulation"
    elif verdict in ("malicious", "suspicious"):
        source_type = "real_world_report"
    else:
        source_type = data.get('source_type') or "real_world_report"

    if source_type not in database.VALID_SOURCE_TYPES:
        return jsonify({
            "error": f"source_type wajib diisi dan harus salah satu dari "
                     f"{database.VALID_SOURCE_TYPES}",
            "received": source_type
        }), 400

    divisi = data.get('divisi') or 'User Report'

    ticket_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

    severity = (data.get('severity') or '').lower()
    if severity not in database.VALID_SEVERITIES:
        severity = 'high' if verdict in ('malicious', 'suspicious') else 'low'

    try:
        database.create_incident(
            ticket_id=ticket_id,
            source_type=source_type,
            divisi=divisi,
            severity=severity,
            reported_url=reported_url,
            vt_verdict=vt_verdict,
            urlscan_verdict=urlscan_verdict,
            screenshot_url=data.get('screenshot_url'),
            checklist=data.get('checklist'),
            file_hash=data.get('file_hash'),
            original_filename=data.get('original_filename')
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "gagal membuat ticket", "detail": str(e)}), 500

    response_body = {"message": "Ticket incident berhasil dibuat",
                      "ticket_id": ticket_id, "source_type": source_type,
                      "severity": severity, "source_verdict": source_verdict}

    # Employee rewards belong to the authenticated /api/reports transaction,
    # never an administrator-supplied reporter identity or Telegram chat ID.

    return jsonify(response_body), 201


@incidents_bp.route('/api/incidents/<ticket_id>', methods=['PATCH'])
@require_roles('soc')
def update_incident(ticket_id):
    data = request.get_json(silent=True)
    if not data or 'status' not in data:
        return jsonify({"error": "field 'status' wajib diisi di body"}), 400

    status = data['status']
    try:
        updated = database.update_incident_status(ticket_id, status)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not updated:
        return jsonify({"error": f"ticket_id '{ticket_id}' tidak ditemukan"}), 404

    return jsonify({"message": f"Ticket {ticket_id} status diupdate ke {status}"}), 200


@incidents_bp.route('/api/incidents', methods=['GET'])
@require_roles('soc', 'ciso', 'phishing_admin', 'grc')
def list_incidents():
    source_type = request.args.get('source_type')
    status = request.args.get('status')

    if source_type and source_type not in database.VALID_SOURCE_TYPES:
        return jsonify({
            "error": f"source_type tidak valid: {source_type}",
            "valid_options": database.VALID_SOURCE_TYPES
        }), 400

    incidents = database.list_incidents(source_type=source_type, status=status)
    return jsonify({"incidents": incidents, "count": len(incidents)}), 200

