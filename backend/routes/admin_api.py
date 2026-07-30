from flask import Blueprint, request, jsonify
import database
import gophish_client

admin_api_bp = Blueprint('admin_api', __name__)

def sanitize_gophish_html(html):
    if not html:
        return html
    html = html.strip()
    
    while html.startswith("<!--"):
        end_idx = html.find("-->")
        if end_idx != -1:
            html = html[end_idx+3:].strip()
        else:
            break
            
    import re
    def replacer(match):
        val = match.group(1).strip()
        if not val:
            return match.group(0)
        first_word = val.split()[0]
        if val.startswith('.') or val.startswith('$') or first_word in ['if', 'else', 'end', 'with', 'range', 'template', 'define', 'block']:
            return match.group(0)
        return f"{{{{.{val}}}}}"
        
    html = re.sub(r'\{\{(.*?)\}\}', replacer, html)
    return html

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
    conn = None
    try:
        data = request.get_json(silent=True) or {}
        emails = data.get('emails')
        
        # If emails are not specified or empty, reject with 400 Bad Request
        if not emails or not isinstance(emails, list) or len(emails) == 0:
            return jsonify({
                "error": "No target selected",
                "message": "emails must be a non-empty list. Refusing to sync with an empty target list to prevent accidental broadcast to all users."
            }), 400
            
        result = gophish_client.sync_group('HFL_Target_Group', emails)
        return jsonify({"message": "Group synced successfully", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to sync group", "detail": str(e)}), 500
    finally:
        if conn:
            conn.close()


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


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['DELETE'])
def gophish_delete_campaign(campaign_id):
    try:
        result = gophish_client.delete_campaign(campaign_id)
        return jsonify({"message": "Campaign deleted successfully", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete campaign", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['GET'])
def gophish_get_campaign(campaign_id):
    try:
        result = gophish_client.get_campaign(campaign_id)
        if not result:
            return jsonify({"error": "Campaign not found"}), 404
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch campaign details", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/templates', methods=['POST'])
def gophish_create_template():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'subject', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        result = gophish_client.create_template(
            name=data['name'],
            subject=data['subject'],
            html=sanitize_gophish_html(data['html']),
            text=data.get('text'),
        )
        return jsonify({"message": "Template created successfully", "result": result}), 201
    except Exception as e:
        return jsonify({"error": "Failed to create template", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/templates/<int:template_id>', methods=['PUT'])
def gophish_update_template(template_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'subject', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        result = gophish_client.update_template(
            template_id=template_id,
            name=data['name'],
            subject=data['subject'],
            html=sanitize_gophish_html(data['html']),
            text=data.get('text'),
        )
        return jsonify({"message": "Template updated successfully", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to update template", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/templates/<int:template_id>', methods=['DELETE'])
def gophish_delete_template(template_id):
    try:
        gophish_client.delete_template(template_id)
        return jsonify({"message": "Template deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete template", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages', methods=['POST'])
def gophish_create_page():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        result = gophish_client.create_page(
            name=data['name'],
            html=sanitize_gophish_html(data['html']),
            capture_credentials=data.get('capture_credentials', True),
            capture_passwords=data.get('capture_passwords', True),
            redirect_url=data.get('redirect_url', ''),
        )
        return jsonify({"message": "Landing page created successfully", "result": result}), 201
    except Exception as e:
        return jsonify({"error": "Failed to create landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages/<int:page_id>', methods=['PUT'])
def gophish_update_page(page_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        result = gophish_client.update_page(
            page_id=page_id,
            name=data['name'],
            html=sanitize_gophish_html(data['html']),
            capture_credentials=data.get('capture_credentials', True),
            capture_passwords=data.get('capture_passwords', True),
            redirect_url=data.get('redirect_url', ''),
        )
        return jsonify({"message": "Landing page updated successfully", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to update landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages/<int:page_id>', methods=['DELETE'])
def gophish_delete_page(page_id):
    try:
        gophish_client.delete_page(page_id)
        return jsonify({"message": "Landing page deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/import-site', methods=['POST'])
def gophish_import_site():
    """Clone HTML dari URL situs asli buat starting point landing page.
    TIDAK langsung bikin page di GoPhish — cuma return HTML mentahnya
    biar admin bisa review/edit dulu di builder sebelum di-save."""
    data = request.get_json(silent=True)
    if not data or not data.get('url'):
        return jsonify({"error": "Field 'url' is required"}), 400

    try:
        result = gophish_client.import_site(
            url=data['url'],
            include_resources=data.get('include_resources', False),
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Failed to clone site", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/employees', methods=['GET'])
def list_employees():
    try:
        employees = database.list_employees()
        return jsonify({"employees": employees}), 200
    except Exception as e:
        return jsonify({"error": "Failed to list employees", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threat-cache', methods=['GET'])
def list_threat_cache():
    try:
        cache = database.list_threat_cache()
        return jsonify({"cache": cache}), 200
    except Exception as e:
        return jsonify({"error": "Failed to list threat cache", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threat-cache', methods=['POST'])
def save_threat_cache_api():
    try:
        data = request.get_json(silent=True) or {}
        indicator = data.get('url')
        if not indicator:
            return jsonify({"error": "url is required"}), 400
        
        threat_type = data.get('threatType', 'suspicious')
        action = data.get('action', 'warning')
        score = data.get('score', 50)
        
        analysis = {
            "providers": [data.get('source', 'internal')],
            "verdict": 'malicious' if threat_type == 'phishing' or threat_type == 'credential_harvesting' else 'suspicious' if threat_type == 'suspicious' else 'safe',
            "severity": 'high' if action == 'block' else 'medium' if action == 'warning' else 'low',
            "confidence": score
        }
        database.save_threat_cache(indicator, "url", analysis)
        return jsonify({"message": "Threat cache entry saved successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Failed to save threat cache", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/employees', methods=['POST'])
def add_employee():
    data = request.get_json(silent=True)
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400
    
    divisi = data.get('divisi', 'Unknown')
    is_active = data.get('is_active', 1)
    
    try:
        database.add_employee(data['email'], divisi, is_active)
        return jsonify({"message": "Employee added successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Failed to add employee", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/employees', methods=['PUT'])
def edit_employee():
    data = request.get_json(silent=True)
    if not data or 'old_email' not in data or 'email' not in data:
        return jsonify({"error": "old_email and email are required"}), 400
        
    divisi = data.get('divisi', 'Unknown')
    is_active = data.get('is_active', 1)
    
    try:
        database.update_employee(data['old_email'], data['email'], divisi, is_active)
        return jsonify({"message": "Employee updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to update employee", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/divisions', methods=['GET'])
def list_divisions():
    try:
        divisions = database.list_divisions()
        return jsonify({"divisions": divisions}), 200
    except Exception as e:
        return jsonify({"error": "Failed to list divisions", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/divisions', methods=['POST'])
def create_division():
    data = request.get_json(silent=True)
    if not data or 'name' not in data:
        return jsonify({"error": "Division name is required"}), 400
        
    try:
        database.create_division(data['name'])
        return jsonify({"message": "Division created successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Failed to create division", "detail": str(e)}), 500