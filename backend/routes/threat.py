from flask import Blueprint, request, jsonify
import integrations
import database
from security import current_identity, authenticate_session_request, require_roles
from werkzeug.exceptions import RequestEntityTooLarge
from services.error_codes import error_body

threat_bp = Blueprint("threat", __name__)


@threat_bp.route("/api/reports", methods=["GET", "POST"])
@require_roles("employee")
def employee_reports():
    from services import report_service
    import uuid
    identity = current_identity()
    try:
        if request.method == "GET":
            return jsonify({"reports": report_service.list_reports(identity)})
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "JSON object wajib diisi"}), 400
        result = report_service.submit(identity, body.get("url"), body.get("description", ""),
                                       request.headers.get("X-Request-ID") or str(uuid.uuid4()))
        return jsonify({"success": True, **result}), 200 if result["duplicate"] else 201
    except (ValueError, TypeError) as exc:
        return jsonify(error_body(exc)), 400
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Employee report could not be persisted")
        return jsonify({"error": "Laporan belum diterima. Silakan coba kembali."}), 503


@threat_bp.route('/api/reports/pdf', methods=['POST'])
@require_roles('employee')
def employee_pdf_report():
    return jsonify({'error': 'PDF reporting is retired. Use Scan file in URL & file security.'}), 410


@threat_bp.route('/api/threat/file-scan', methods=['GET', 'POST'])
@require_roles('employee')
def employee_file_scan():
    from services import report_service
    import uuid
    # AfferentRequest limits parsing before accessing request.files.
    try:
        if request.method == 'GET':
            response = jsonify({'scans': report_service.list_file_scans(current_identity()),
                                'maxBytes': report_service.file_max_bytes()})
            response.headers['Cache-Control'] = 'private, no-store'
            return response
        result = report_service.submit_file_scan(current_identity(), request.files.get('file'),
            request.form.get('consent', ''),
            request.headers.get('X-Request-ID') or str(uuid.uuid4()))
        return jsonify({'success': True, **result}), 200 if result['duplicate'] else 202
    except RequestEntityTooLarge:
        return jsonify({'error': 'File upload exceeds the size limit.', 'code': 'FILE_TOO_LARGE'}), 413
    except (ValueError, TypeError) as exc:
        return jsonify(error_body(exc)), 400
    except Exception:
        return jsonify({'error': 'File scan could not be accepted. Please retry.'}), 503


@threat_bp.route('/api/threat/scan', methods=['POST'])
@require_roles('employee')
def scan_url_reputation():
    from services import report_service
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'A JSON object is required.'}), 400
    try:
        report_service.rate_limit(current_identity(), 'url-scan')
        return jsonify({'success': True, 'data': report_service.analyze_url(body.get('url'))})
    except (ValueError, TypeError) as exc:
        return jsonify(error_body(exc)), 400
    except Exception:
        return jsonify({'error': 'Reputation providers are temporarily unavailable.'}), 503


@threat_bp.route("/api/threat/analyze", methods=["POST"])
def analyze_threat():
    # Retire the Telegram-era mixed ML/VT gateway. Full-URL scans and employee
    # reports have distinct, authenticated contracts and reward ownership.
    return jsonify({'error': 'Endpoint lama dihentikan. Gunakan /api/threat/scan-dl untuk ML atau /api/reports untuk laporan.'}), 410


@threat_bp.route("/api/threat/stats", methods=["GET"])
def threat_stats():
    identity = current_identity() or authenticate_session_request(request)
    wib_date = database.get_current_wib_date()
    email = identity.email if identity and getattr(identity, "email", None) else None
    count = database.get_daily_threat_reward_count(email, wib_date) if email else 0
    return jsonify({
        "authenticated": bool(email),
        "email": email,
        "daily_count": count,
        "daily_cap": database.DAILY_REWARD_CAP,
        "wib_date": wib_date
    }), 200


@threat_bp.route("/api/debug/vt", methods=["POST"])
@require_roles('soc')
def debug_vt():

    body = request.get_json()

    indicator = body["indicator"]

    raw = integrations.scan_virustotal(indicator)

    return jsonify(raw)


@threat_bp.route("/api/threat/scan-dl", methods=["POST"])
def scan_dl():
    """Scan a URL directly using the Char-BiLSTM Deep Learning model (Afferent v5)."""
    body = request.get_json(silent=True) or {}
    url = body.get("url") or body.get("indicator")

    if not url:
        return jsonify({
            "success": False,
            "error": "Field 'url' atau 'indicator' wajib diisi."
        }), 400

    from services.ml_service import scan
    try:
        dl_result = scan(url)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    if dl_result is None:
        return jsonify({
            "success": False,
            "error": "ML belum siap atau sibuk. Tidak ada verdict aman yang diasumsikan."
        }), 503

    return jsonify({
        "success": True,
        "data": dl_result
    }), 200


@threat_bp.route("/api/threat/model-status", methods=["GET"])
@require_roles("soc", "ciso", "phishing_admin")
def model_status():
    import char_bilstm_scanner
    from services.domain_scanner import status as domain_status
    return jsonify({**char_bilstm_scanner.model_status(), "proxyDomainModel": domain_status()})
