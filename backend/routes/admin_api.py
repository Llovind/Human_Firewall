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
@admin_api_bp.route('/api/admin/leaderboard', methods=['GET'])
def leaderboard():
    """Handoff Step A.4 — Leaderboard UI Tab data source. Mengembalikan
    ranking individu (berdasarkan poin) dan rata-rata poin per divisi."""
    return jsonify(database.get_leaderboard()), 200


@admin_api_bp.route('/api/login-history', methods=['GET'])
@admin_api_bp.route('/api/admin/login-history', methods=['GET'])
def login_history():
    """Audit log riwayat login admin/user."""
    try:
        logs = database.list_login_history() if hasattr(database, 'list_login_history') else []
        return jsonify({"logs": logs}), 200
    except Exception:
        return jsonify({"logs": []}), 200


def _verify_grc_ciso_access():
    """Helper to check if requesting user has GRC or CISO role."""
    import os
    if os.environ.get('DEV_BYPASS_AUTH', 'false').lower() == 'true':
        return None

    role = (request.args.get('role') or request.headers.get('X-User-Role') or '').lower()
    if role not in ['grc', 'ciso', 'admin', 'soc', 'phishing_admin']:
        return jsonify({
            "error": "Access Denied",
            "detail": f"GRC Compliance Readiness data is restricted to GRC and CISO roles only."
        }), 403
    return None


@admin_api_bp.route('/api/compliance-summary', methods=['GET'])
@admin_api_bp.route('/api/admin/compliance-summary', methods=['GET'])
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


def _enrich_campaign_stats(c):
    if not isinstance(c, dict):
        return c
    results = c.get('results') or []
    timeline = c.get('timeline') or []
    
    sent_emails = set()
    opened_emails = set()
    clicked_emails = set()
    submitted_emails = set()
    error_emails = set()

    for r in results:
        st = (r.get('status') or '').lower()
        em = r.get('email')
        if not em:
            continue
        if any(k in st for k in ['sent', 'open', 'click', 'submit', 'success']):
            sent_emails.add(em)
        if any(k in st for k in ['open', 'click', 'submit']):
            opened_emails.add(em)
        if any(k in st for k in ['click', 'submit']):
            clicked_emails.add(em)
        if 'submit' in st:
            submitted_emails.add(em)
        if 'error' in st:
            error_emails.add(em)

    for ev in timeline:
        msg = (ev.get('message') or '').lower()
        em = ev.get('email')
        if not em:
            continue
        if 'email sent' in msg or 'sent' in msg:
            sent_emails.add(em)
        if 'email opened' in msg or 'opened' in msg:
            opened_emails.add(em)
        if 'clicked link' in msg or 'click' in msg:
            clicked_emails.add(em)
        if 'submitted data' in msg or 'submit' in msg:
            submitted_emails.add(em)
        if 'error' in msg:
            error_emails.add(em)

    total_targets = len(results) or len(sent_emails) or 0
    c['stats'] = {
        'total': total_targets,
        'sent': len(sent_emails),
        'opened': len(opened_emails),
        'clicked': len(clicked_emails),
        'submitted_data': len(submitted_emails),
        'error': len(error_emails)
    }
    return c


@admin_api_bp.route('/api/admin/gophish/campaigns', methods=['GET'])
def gophish_campaigns():
    combined = []
    # 1. Fetch local campaigns
    try:
        local_camps = database.list_simulation_campaigns()
        combined.extend(local_camps)
    except Exception as e:
        logger.warning(f"Error fetching local simulation campaigns: {e}")

    # 2. Fetch GoPhish campaigns if available
    try:
        gp_camps = gophish_client.get_campaigns()
        if isinstance(gp_camps, list):
            enriched_gp = [_enrich_campaign_stats(c) for c in gp_camps]
            existing_names = {c.get("name") for c in combined}
            for gp_c in enriched_gp:
                if gp_c.get("name") not in existing_names:
                    combined.append(gp_c)
    except Exception:
        pass

    return jsonify(combined), 200


@admin_api_bp.route('/api/admin/gophish/resources', methods=['GET'])
def gophish_resources():
    templates = []
    pages = []
    profiles = []

    try:
        templates = gophish_client.get_templates() or []
        pages = gophish_client.get_pages() or []
        profiles = gophish_client.get_sending_profiles() or []
    except Exception:
        pass

    # Provide default resources so forms always have usable options
    if not templates:
        templates = [
            {"id": 1, "name": "Urgent Security Verification", "subject": "[URGENT] Security Alert: Corporate Account Re-Authentication", "html": "<p>Halo {{.FirstName}},</p><p>Sistem keamanan mendeteksi aktivitas login mencurigakan. Verifikasi akun: <a href=\"{{.URL}}\">Klik di sini</a></p>"},
            {"id": 2, "name": "HR Payroll & Benefit Update", "subject": "Pemberitahuan Penyesuaian Benefit & Bonus Q3 2026", "html": "<p>Yth. {{.FirstName}},</p><p>Lampiran penyesuaian gaji dan benefit terbaru dapat diakses di portal HR: <a href=\"{{.URL}}\">Buka Dokumen</a></p>"}
        ]
    if not pages:
        pages = [
            {"id": 1, "name": "Corporate SSO Login Portal", "capture_credentials": True, "capture_passwords": False},
            {"id": 2, "name": "Microsoft 365 Verification Page", "capture_credentials": True, "capture_passwords": True}
        ]
    if not profiles:
        profiles = [
            {"id": 1, "name": "IT Security Notification Gateway (SMTP)"},
            {"id": 2, "name": "HR Automated System Mailer"}
        ]

    return jsonify({
        "templates": templates,
        "pages": pages,
        "profiles": profiles
    }), 200


@admin_api_bp.route('/api/admin/gophish/sync', methods=['POST'])
def gophish_sync():
    try:
        data = request.get_json(silent=True) or {}
        emails = data.get('emails')
        
        # If emails are not specified or empty, sync active employees from user_history
        if not emails or not isinstance(emails, list) or len(emails) == 0:
            conn = database.get_connection()
            try:
                rows = conn.execute("SELECT email FROM user_history WHERE is_active = 1").fetchall()
                emails = [r["email"] for r in rows]
            finally:
                conn.close()

        result = None
        try:
            result = gophish_client.sync_group('HFL_Target_Group', emails)
        except Exception as gp_err:
            logger.warning(f"GoPhish sync group offline/skipped: {gp_err}")
            
        return jsonify({"message": f"Berhasil menyinkronkan {len(emails)} karyawan ke target group.", "result": result}), 200
    except Exception as e:
        return jsonify({"error": "Failed to sync group", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/launch', methods=['POST'])
def gophish_launch():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    if not name:
        return jsonify({"error": "Field 'name' is required"}), 400

    template_id = data.get('template_id', 1)
    page_id = data.get('page_id', 1)
    smtp_id = data.get('smtp_id', 1)
    url = data.get('url', 'http://phish.afferent.local/login')
    group_name = data.get('group_name', 'HFL_Target_Group')
    target_emails = data.get('target_emails')

    # Resolve target emails if not passed
    if not target_emails or not isinstance(target_emails, list) or len(target_emails) == 0:
        conn = database.get_connection()
        try:
            rows = conn.execute("SELECT email FROM user_history WHERE is_active = 1").fetchall()
            target_emails = [r["email"] for r in rows]
        finally:
            conn.close()

    # Resolve template subject & html
    template_name = "Corporate Security Notice"
    subject = None
    html_content = None
    try:
        templates = gophish_client.get_templates()
        if templates and isinstance(templates, list):
            match = next((t for t in templates if str(t.get("id")) == str(template_id) or t.get("name") == str(template_id)), None)
            if match:
                template_name = match.get("name", template_name)
                subject = match.get("subject")
                html_content = match.get("html")
    except Exception:
        pass

    # 1. Create local simulation campaign and DISPATCH to Mock Webmail Inbox for all target employees!
    try:
        local_id = database.create_simulation_campaign(
            name=name,
            template_name=template_name,
            page_name=str(page_id),
            url=url,
            target_emails=target_emails,
            subject=subject,
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"Failed to create local simulation campaign: {e}")
        return jsonify({"error": "Failed to create campaign", "detail": str(e)}), 500

    # 2. Try to launch in GoPhish if service is available
    gp_result = None
    try:
        gp_result = gophish_client.launch_campaign(
            name=name,
            template_id=template_id,
            url=url,
            page_id=page_id,
            smtp_id=smtp_id,
            group_name=group_name
        )
    except Exception as gp_err:
        logger.warning(f"GoPhish launch offline/skipped (fallback to local mock webmail delivery): {gp_err}")

    return jsonify({
        "message": f"Simulasi phishing '{name}' berhasil diluncurkan! {len(target_emails)} email telah dikirimkan ke Mock Webmail Inbox.",
        "campaign_id": local_id,
        "gophish_result": gp_result,
        "target_count": len(target_emails)
    }), 201


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['DELETE'])
def gophish_delete_campaign(campaign_id):
    try:
        database.delete_simulation_campaign(campaign_id)
        try:
            gophish_client.delete_campaign(campaign_id)
        except Exception:
            pass
        return jsonify({"message": "Campaign deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete campaign", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['GET'])
def gophish_get_campaign(campaign_id):
    try:
        result = gophish_client.get_campaign(campaign_id)
        if not result:
            return jsonify({"error": "Campaign not found"}), 404
        return jsonify(_enrich_campaign_stats(result)), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch campaign details", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>/complete', methods=['POST'])
def gophish_complete_campaign(campaign_id):
    try:
        database.complete_simulation_campaign(campaign_id)
        try:
            gophish_client.complete_campaign(campaign_id)
        except Exception:
            pass
        return jsonify({"message": "Campaign completed successfully"}), 200
    except Exception as e:
        logger.error(f"[admin_api] Error completing campaign {campaign_id}: {e}")
        return jsonify({"error": "Failed to complete campaign", "detail": str(e)}), 500


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


@admin_api_bp.route('/api/admin/threats/feed', methods=['GET'])
@admin_api_bp.route('/api/threats/feed', methods=['GET'])
@admin_api_bp.route('/api/admin/threat-cache', methods=['GET'])
def get_threats_feed():
    try:
        indicator_type = request.args.get('type')
        action = request.args.get('action')
        limit = request.args.get('limit', 100, type=int)
        feed_data = database.get_unified_threat_feed(indicator_type=indicator_type, action=action, limit=limit)
        return jsonify(feed_data), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch threat feed", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threats/action', methods=['POST'])
@admin_api_bp.route('/api/threats/action', methods=['POST'])
def execute_threat_action():
    try:
        data = request.get_json(silent=True) or {}
        indicator = data.get('indicator') or data.get('url')
        action = data.get('action')
        reason = data.get('reason', '')
        if not indicator or not action:
            return jsonify({"error": "indicator and action are required"}), 400
        
        result = database.take_threat_action(indicator, action, reason)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Failed to execute threat action", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threat-cache', methods=['POST'])
def save_threat_cache_api():
    try:
        data = request.get_json(silent=True) or {}
        indicator = data.get('url') or data.get('indicator')
        if not indicator:
            return jsonify({"error": "url is required"}), 400
        
        threat_type = data.get('threatType', 'suspicious')
        action = data.get('action', 'warning')
        score = data.get('score', 50)
        
        analysis = {
            "providers": [data.get('source', 'internal')],
            "verdict": 'malicious' if threat_type in ('phishing', 'credential_harvesting') else 'suspicious' if threat_type == 'suspicious' else 'safe',
            "severity": 'high' if action == 'block' else 'medium' if action == 'warning' else 'low',
            "confidence": score
        }
        database.save_threat_cache(indicator, "url", analysis)
        return jsonify({"message": "Threat cache entry saved successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Failed to save threat cache", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/policy/decisions', methods=['GET'])
@admin_api_bp.route('/api/policy/decisions', methods=['GET'])
@admin_api_bp.route('/api/policy', methods=['GET'])
def get_policy_decisions():
    try:
        limit = request.args.get('limit', 50, type=int)
        decisions = database.get_policy_decisions(limit=limit)
        return jsonify({"decisions": decisions}), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch policy decisions", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/policy/evaluate', methods=['POST'])
@admin_api_bp.route('/api/policy/evaluate', methods=['POST'])
def evaluate_policy_api():
    try:
        import policy
        data = request.get_json(silent=True) or {}
        threat_score = data.get('threatScore', 50)
        user_tier = data.get('userTier', 'Guardian')
        verdict = data.get('verdict', 'unknown')
        
        res = policy.evaluate_2d(threat_score=threat_score, user_tier=user_tier, verdict=verdict)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": "Failed to evaluate policy", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/ai/summaries', methods=['GET'])
@admin_api_bp.route('/api/ai/summaries', methods=['GET'])
@admin_api_bp.route('/api/summary', methods=['GET'])
def get_ai_summaries():
    try:
        limit = request.args.get('limit', 5, type=int)
        summaries = database.get_ai_threat_summaries(limit=limit)
        return jsonify({"summaries": summaries}), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch AI summaries", "detail": str(e)}), 500


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