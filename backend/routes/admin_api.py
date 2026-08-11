from flask import Blueprint, request, jsonify
import database
import gophish_client

admin_api_bp = Blueprint('admin_api', __name__)

@admin_api_bp.route('/api/dashboard-summary', methods=['GET'])
def dashboard_summary():
    summary = database.get_dashboard_summary()
    return jsonify(summary), 200


@admin_api_bp.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    """Handoff Step A.4 — Leaderboard UI Tab data source. Mengembalikan
    ranking individu (berdasarkan poin) dan rata-rata poin per divisi."""
    return jsonify(database.get_leaderboard()), 200


@admin_api_bp.route('/api/compliance-summary', methods=['GET'])
def compliance_summary():
    """Mengembalikan data kepatuhan regulasi UU PDP & BSSN untuk
    Dashboard SOC. Dipanggil oleh dashboard.html via AJAX."""
    return jsonify(database.get_compliance_summary()), 200


@admin_api_bp.route('/api/admin/gophish/campaigns', methods=['GET'])
def gophish_campaigns():
    try:
        campaigns = gophish_client.get_campaigns()
        return jsonify(campaigns), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch campaigns", "detail": str(e)}), 500


def _verify_grc_ciso_access():
    """Helper to check if requesting user has GRC or CISO role."""
    role = (request.args.get('role') or request.headers.get('X-User-Role') or '').lower()
    if role not in ['grc', 'ciso']:
        return jsonify({
            "error": "Access Denied",
            "detail": f"GRC Compliance Readiness data is restricted to GRC and CISO roles only. Provided role '{role or 'none'}' is forbidden."
        }), 403
    return None


@admin_api_bp.route('/api/compliance-summary', methods=['GET'])
def compliance_summary():
    """Mengembalikan skor Kesiapan Kepatuhan (Readiness Level) terklasifikasi
    berdasarkan klausul resmi ISO 27001:2022 dan UU PDP No. 27/2022."""
    access_error = _verify_grc_ciso_access()
    if access_error:
        return access_error
    return jsonify(database.get_compliance_summary()), 200


@admin_api_bp.route('/api/admin/readiness-thresholds', methods=['GET'])
def get_readiness_thresholds_route():
    """Mengembalikan daftar ambang batas kesiapan GRC."""
    access_error = _verify_grc_ciso_access()
    if access_error:
        return access_error
    return jsonify(database.get_readiness_thresholds()), 200


@admin_api_bp.route('/api/admin/readiness-thresholds', methods=['POST'])
def update_readiness_threshold_route():
    """Update ambang batas kesiapan GRC. Menolak perubahan jika is_legally_mandated = 1."""
    access_error = _verify_grc_ciso_access()
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    clause_id = data.get('clause_id')
    target_value = data.get('target_value')

    if not clause_id:
        return jsonify({"error": "clause_id is required"}), 400

    try:
        database.update_readiness_threshold(clause_id, target_value)
        return jsonify({"message": f"Threshold for {clause_id} updated successfully"}), 200
    except ValueError as ve:
        return jsonify({"error": "Update rejected", "detail": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": "Failed to update threshold", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/resources', methods=['GET'])
def gophish_resources():
    try:
        templates = gophish_client.get_templates()
        pages = gophish_client.get_pages()
        profiles = gophish_client.get_sending_profiles()
        return jsonify({
            "templates": templates,
            "pages": pages,
            "profiles": profiles
        }), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch resources", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/sync', methods=['POST'])
def gophish_sync():
    try:
        conn = database.get_connection()
        cursor = conn.cursor()
        users = cursor.execute("SELECT email, divisi FROM user_history").fetchall()
        emails = [row['email'] for row in users]
        
        result = gophish_client.sync_group('HFL_Target_Group', emails)
        return jsonify({"message": "Group synced successfully", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to sync group", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/launch', methods=['POST'])
def gophish_launch():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'template_id', 'url', 'page_id', 'smtp_id', 'group_name']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        result = gophish_client.launch_campaign(
            name=data['name'],
            template_id=data['template_id'],
            url=data['url'],
            page_id=data['page_id'],
            smtp_id=data['smtp_id'],
            group_name=data['group_name']
        )
        return jsonify({"message": "Campaign launched successfully", "result": result}), 201
    except Exception as e:
        return jsonify({"error": "Failed to launch campaign", "detail": str(e)}), 500
