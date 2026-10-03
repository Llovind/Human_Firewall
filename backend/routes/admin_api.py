from flask import Blueprint, request, jsonify
import database
import gophish_client
import logging
import os
import uuid
from urllib.parse import urlsplit, urlunsplit
from security import current_identity, require_roles
from services import auth_service

admin_api_bp = Blueprint('admin_api', __name__)
logger = logging.getLogger(__name__)


@admin_api_bp.errorhandler(gophish_client.GoPhishError)
def gophish_error(exc):
    return jsonify({'error': str(exc)}), exc.status


def simulation_targets(values=None):
    conn = database.get_connection()
    try:
        rows = conn.execute("""SELECT u.email FROM user_history u LEFT JOIN employee_accounts a
            ON lower(a.email)=lower(u.email) WHERE u.is_active=1
            AND (a.id IS NULL OR (a.is_active=1 AND a.role='employee'))""").fetchall()
    finally:
        conn.close()
    allowed = {r['email'].lower(): r['email'] for r in rows}
    if values is None:
        return list(allowed.values())
    if not isinstance(values, list) or not values or any(not isinstance(e, str) for e in values):
        raise ValueError('Pilih minimal satu karyawan sebagai penerima simulasi.')
    emails = list(dict.fromkeys(e.strip().lower() for e in values))
    if any(e not in allowed for e in emails):
        raise ValueError('Penerima harus karyawan aktif; SOC/admin tidak menjadi target.')
    return [allowed[e] for e in emails]


def safe_campaign(campaign, source):
    result = dict(campaign)
    result['source'] = source
    if 'smtp' in result:
        result['smtp'] = {k: result['smtp'].get(k) for k in ('id', 'name', 'host', 'from_address')}
    result['timeline'] = [{k: event.get(k) for k in ('email', 'time', 'message')} for event in result.get('timeline', [])]
    return result


def campaign_source(campaign_id):
    source = request.args.get('source', 'gophish')
    if source not in ('local', 'gophish'):
        raise ValueError('Source campaign tidak valid.')
    campaign = next((c for c in database.list_simulation_campaigns() if c['id'] == campaign_id), None) if source == 'local' else gophish_client.get_campaign(campaign_id)
    return source, campaign


@admin_api_bp.route('/api/admin/security-inbox', methods=['GET'])
@require_roles('soc', 'grc')
def security_inbox():
    from services.notification_service import security_inbox as inbox
    try:
        return jsonify(inbox())
    except Exception:
        return jsonify({'error': 'Inbox belum tersedia; coba kembali'}), 503


@admin_api_bp.route('/api/admin/security-inbox/warnings', methods=['POST'])
@require_roles('soc', 'grc')
def manual_warning():
    import uuid
    from services.notification_service import queue_manual_warning
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'error': 'JSON object wajib diisi'}), 400
    try:
        return jsonify(queue_manual_warning(current_identity(), body.get('accountId'),
            body.get('reason'), request.headers.get('X-Request-ID') or str(uuid.uuid4()))), 202
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception:
        return jsonify({'error': 'Warning belum diterima; periksa inbox sebelum mencoba lagi'}), 503

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
@require_roles('phishing_admin', 'soc', 'grc', 'ciso')
def dashboard_summary():
    summary = database.get_dashboard_summary()
    return jsonify(summary), 200


@admin_api_bp.route('/api/leaderboard', methods=['GET'])
@admin_api_bp.route('/api/admin/leaderboard', methods=['GET'])
@require_roles('employee', 'phishing_admin', 'soc', 'grc', 'ciso')
def leaderboard():
    """Handoff Step A.4 — Leaderboard UI Tab data source. Mengembalikan
    ranking individu (berdasarkan poin) dan rata-rata poin per divisi."""
    result = database.get_leaderboard()
    identity = current_identity()
    if identity and identity.role == 'employee':
        result['individual'] = [
            row for row in result.get('individual', [])
            if str(row.get('email', '')).lower() == identity.email.lower()
        ]
    return jsonify(result), 200


@admin_api_bp.route('/api/login-history', methods=['GET'])
@admin_api_bp.route('/api/admin/login-history', methods=['GET'])
@require_roles('phishing_admin', 'soc', 'ciso')
def login_history():
    """Audit log riwayat login admin/user."""
    try:
        logs = auth_service.list_login_audit(request.args.get('limit', 100, type=int))
        return jsonify({"logs": logs}), 200
    except Exception:
        return jsonify({'error': 'Login audit unavailable'}), 503


@admin_api_bp.route('/api/compliance-summary', methods=['GET'])
@admin_api_bp.route('/api/admin/compliance-summary', methods=['GET'])
@require_roles('grc', 'ciso')
def compliance_summary():
    """Mengembalikan skor Kesiapan Kepatuhan (Readiness Level) terklasifikasi
    berdasarkan klausul resmi ISO 27001:2022 dan UU PDP No. 27/2022."""
    return jsonify(database.get_compliance_summary()), 200


@admin_api_bp.route('/api/admin/readiness-thresholds', methods=['GET'])
@require_roles('grc', 'ciso')
def get_readiness_thresholds_route():
    """Mengembalikan daftar ambang batas kesiapan GRC."""
    return jsonify(database.get_readiness_thresholds()), 200


@admin_api_bp.route('/api/admin/readiness-thresholds', methods=['POST'])
@require_roles('grc')
def update_readiness_threshold_route():
    """Update ambang batas kesiapan GRC. Menolak perubahan jika is_legally_mandated = 1."""

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
@require_roles('phishing_admin', 'ciso')
def gophish_campaigns():
    combined = []
    # 1. Fetch local campaigns
    try:
        local_camps = database.list_simulation_campaigns()
        combined.extend(safe_campaign(c, 'local') for c in local_camps)
    except Exception as e:
        logger.warning(f"Error fetching local simulation campaigns: {e}")

    # 2. Fetch GoPhish campaigns if available
    try:
        gp_camps = gophish_client.get_campaigns()
        if isinstance(gp_camps, list):
            enriched_gp = [_enrich_campaign_stats(c) for c in gp_camps]
            for gp_c in enriched_gp:
                database.sync_gophish_events(gp_c)
                combined.append(safe_campaign(gp_c, 'gophish'))
    except gophish_client.GoPhishError as exc:
        return jsonify({'error': str(exc), 'campaigns': combined}), exc.status

    return jsonify(combined), 200


@admin_api_bp.route('/api/admin/gophish/resources', methods=['GET'])
@require_roles('phishing_admin', 'ciso')
def gophish_resources():
    from services.campaign_materials import education_url
    try:
        education = education_url()
    except gophish_client.GoPhishError:
        education = ''
    templates = gophish_client.get_templates() or []
    pages = gophish_client.get_pages() or []
    profiles = [{k: p.get(k) for k in ('id', 'name', 'host', 'from_address')}
                for p in gophish_client.get_sending_profiles() or []]
    base = os.environ.get('GOPHISH_PHISH_PUBLIC_URL', '').strip()
    if not base:
        parts = urlsplit(os.environ.get('SERVER_BASE_URL') or os.environ.get('SIMULATION_BASE_URL') or '')
        if parts.hostname:
            host = f'[{parts.hostname}]' if ':' in parts.hostname else parts.hostname
            base = urlunsplit(('http', f'{host}:8080', '', '', ''))
    return jsonify({
        "templates": templates,
        "pages": pages,
        "profiles": profiles,
        "connected": True,
        "phishUrl": base,
        "educationUrl": education,
        "adminUrl": os.environ.get('GOPHISH_ADMIN_PUBLIC_URL', 'https://localhost:3333'),
        "mailpitUrl": os.environ.get('MAILPIT_PUBLIC_URL', 'http://127.0.0.1:8025'),
    }), 200


@admin_api_bp.route('/api/admin/gophish/resources/setup', methods=['POST'])
@require_roles('phishing_admin')
def gophish_setup():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict) or data.get('preset') not in (None, 'password-reset'):
        return jsonify({'error': 'Preset tidak valid.'}), 400
    if data.get('preset') == 'password-reset':
        from services.campaign_materials import prepare_password_reset
        return jsonify(prepare_password_reset()), 200
    return jsonify(gophish_client.ensure_demo_resources()), 200


@admin_api_bp.route('/api/admin/gophish/sync', methods=['POST'])
@require_roles('phishing_admin')
def gophish_sync():
    try:
        data = request.get_json(silent=True) or {}
        emails = simulation_targets(data.get('emails'))
        if not emails:
            return jsonify({'error': 'Tidak ada karyawan aktif.'}), 400
        result = gophish_client.sync_group('HFL_Target_Group', emails)
            
        return jsonify({"message": f"Berhasil menyinkronkan {len(emails)} karyawan ke target group.", "result": result}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@admin_api_bp.route('/api/admin/gophish/launch', methods=['POST'])
@require_roles('phishing_admin')
def gophish_launch():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({'error': 'JSON object wajib diisi.'}), 400
    name = data.get('name')
    url = data.get('url')
    if not isinstance(name, str) or not name.strip() or len(name) > 150:
        return jsonify({'error': 'Nama campaign wajib diisi, maksimal 150 karakter.'}), 400
    try:
        parsed = urlsplit(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or '{{' in url:
            raise ValueError('URL harus alamat HTTP/HTTPS GoPhish lab yang dapat diakses penerima (port 8080), bukan /redirect-handler.')
        if parsed.path not in ('', '/'):
            raise ValueError('Gunakan base URL GoPhish tanpa path, misalnya http://IP-SERVER:8080.')
        targets = simulation_targets(data.get('target_emails', []))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    template = gophish_client.resolve_resource(gophish_client.get_templates(), data.get('template_id'), 'Template')
    page = gophish_client.resolve_resource(gophish_client.get_pages(), data.get('page_id'), 'Landing page')
    profile = gophish_client.resolve_resource(gophish_client.get_sending_profiles(), data.get('smtp_id'), 'Sending profile')
    if profile.get('host') != 'mailpit:1025':
        return jsonify({'error': 'Demo ini hanya mendukung sending profile Mailpit (mailpit:1025).'}), 400
    group_name = f'AFFERENT-{uuid.uuid4().hex}'
    gophish_client.sync_group(group_name, targets)
    result = gophish_client.launch_campaign(name.strip(), template['name'], url, page['name'], profile['name'], group_name)
    return jsonify({'message': f'Campaign diterima GoPhish untuk {len(targets)} penerima. Pantau status pengiriman di campaign dan Mailpit.',
        'campaign_id': result['id'], 'source': 'gophish', 'target_count': len(targets)}), 201


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['DELETE'])
@require_roles('phishing_admin')
def gophish_delete_campaign(campaign_id):
    try:
        source, campaign = campaign_source(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign tidak ditemukan.'}), 404
        if source == 'local':
            database.delete_simulation_campaign(campaign_id)
        else:
            gophish_client.delete_campaign(campaign_id)
        return jsonify({"message": "Campaign deleted successfully"}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>', methods=['GET'])
@require_roles('phishing_admin', 'ciso')
def gophish_get_campaign(campaign_id):
    try:
        source, result = campaign_source(campaign_id)
        if not result:
            return jsonify({"error": "Campaign not found"}), 404
        if source == 'gophish':
            database.sync_gophish_events(result)
        return jsonify(safe_campaign(_enrich_campaign_stats(result) if source == 'gophish' else result, source)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@admin_api_bp.route('/api/admin/gophish/campaigns/<int:campaign_id>/complete', methods=['POST'])
@require_roles('phishing_admin')
def gophish_complete_campaign(campaign_id):
    try:
        source, campaign = campaign_source(campaign_id)
        if not campaign:
            return jsonify({'error': 'Campaign tidak ditemukan.'}), 404
        if source == 'local':
            database.complete_simulation_campaign(campaign_id)
        else:
            gophish_client.complete_campaign(campaign_id)
        return jsonify({"message": "Campaign completed successfully"}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@admin_api_bp.route('/api/admin/gophish/templates', methods=['POST'])
@require_roles('phishing_admin')
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
@require_roles('phishing_admin')
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
@require_roles('phishing_admin')
def gophish_delete_template(template_id):
    try:
        gophish_client.delete_template(template_id)
        return jsonify({"message": "Template deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete template", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages', methods=['POST'])
@require_roles('phishing_admin')
def gophish_create_page():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        from services.campaign_materials import simulation_page_html, education_url
        redirect = education_url(data.get('redirect_url'))
        result = gophish_client.create_page(
            name=data['name'],
            html=simulation_page_html(sanitize_gophish_html(data['html']), redirect),
            capture_credentials=False,
            capture_passwords=False,
            redirect_url=redirect,
        )
        return jsonify({"message": "Landing page created successfully", "result": result}), 201
    except gophish_client.GoPhishError:
        raise
    except Exception as e:
        return jsonify({"error": "Failed to create landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages/<int:page_id>', methods=['PUT'])
@require_roles('phishing_admin')
def gophish_update_page(page_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required"}), 400

    required_fields = ['name', 'html']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    try:
        from services.campaign_materials import simulation_page_html, education_url
        redirect = education_url(data.get('redirect_url'))
        result = gophish_client.update_page(
            page_id=page_id,
            name=data['name'],
            html=simulation_page_html(sanitize_gophish_html(data['html']), redirect),
            capture_credentials=False,
            capture_passwords=False,
            redirect_url=redirect,
        )
        return jsonify({"message": "Landing page updated successfully", "result": result}), 200
    except gophish_client.GoPhishError:
        raise
    except Exception as e:
        return jsonify({"error": "Failed to update landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/pages/<int:page_id>', methods=['DELETE'])
@require_roles('phishing_admin')
def gophish_delete_page(page_id):
    try:
        gophish_client.delete_page(page_id)
        return jsonify({"message": "Landing page deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": "Failed to delete landing page", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/gophish/import-site', methods=['POST'])
@require_roles('phishing_admin')
def gophish_import_site():
    """Clone HTML dari URL situs asli buat starting point landing page.
    TIDAK langsung bikin page di GoPhish — cuma return HTML mentahnya
    biar admin bisa review/edit dulu di builder sebelum di-save."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data.get('url'):
        return jsonify({"error": "Field 'url' is required"}), 400

    from services.campaign_materials import clone_with_firecrawl
    return jsonify(clone_with_firecrawl(data['url'], data.get('authorized'))), 200


@admin_api_bp.route('/api/admin/employees', methods=['GET'])
@require_roles('phishing_admin', 'grc', 'ciso')
def list_employees():
    try:
        employees = auth_service.list_accounts()
        return jsonify({"employees": employees}), 200
    except Exception as e:
        return jsonify({"error": "Failed to list employees", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threats/feed', methods=['GET'])
@admin_api_bp.route('/api/threats/feed', methods=['GET'])
@admin_api_bp.route('/api/admin/threat-cache', methods=['GET'])
@require_roles('soc', 'ciso')
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
@require_roles('soc')
def execute_threat_action():
    from services.proxy_service import ProxyError
    try:
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return jsonify({'error': 'JSON object wajib diisi'}), 400
        indicator = data.get('indicator') or data.get('url')
        action = data.get('action')
        reason = data.get('reason') or 'Manual SOC decision from threat feed'
        if not isinstance(reason, str) or len(reason) > 1000 or action not in {'block', 'allow', 'purge'}:
            return jsonify({'error': 'Action/reason tidak valid'}), 400
        reason = reason.strip()
        if not indicator or not action:
            return jsonify({"error": "indicator and action are required"}), 400
        
        if action in {'block', 'allow'}:
            import uuid
            from services import proxy_service
            proxy_service.manual_decision(
                domain_value=indicator,
                action=action,
                reason=reason,
                identity=current_identity(),
                request_id=request.headers.get('X-Request-ID') or str(uuid.uuid4()),
            )
        result = database.take_threat_action(indicator, action, reason)
        return jsonify(result), 200
    except ProxyError as exc:
        return jsonify({'error': str(exc), 'code': exc.code}), exc.status
    except Exception as e:
        return jsonify({"error": "Failed to execute threat action", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/threat-cache', methods=['POST'])
@require_roles('soc', allow_service=True)
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
@require_roles('soc', 'ciso')
def get_policy_decisions():
    try:
        limit = request.args.get('limit', 50, type=int)
        decisions = database.get_policy_decisions(limit=limit)
        return jsonify({"decisions": decisions}), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch policy decisions", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/policy/evaluate', methods=['POST'])
@admin_api_bp.route('/api/policy/evaluate', methods=['POST'])
@require_roles('soc')
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
@require_roles('soc', 'grc', 'ciso')
def get_ai_summaries():
    try:
        limit = request.args.get('limit', 5, type=int)
        summaries = database.get_ai_threat_summaries(limit=limit)
        return jsonify({"summaries": summaries}), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch AI summaries", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/employees', methods=['POST'])
@require_roles('phishing_admin')
def add_employee():
    data = request.get_json(silent=True)
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email dan password wajib diisi"}), 400
    try:
        account = auth_service.create_account(
            email=data['email'],
            password=data['password'],
            role=data.get('role', 'employee'),
            division=data.get('divisi', 'General'),
            is_active=data.get('is_active', 1),
        )
        return jsonify({"message": "Employee dan akun berhasil dibuat", "account": account}), 201
    except auth_service.AuthError as e:
        return jsonify({"error": e.message, "code": e.code}), e.status
    except Exception as e:
        return jsonify({"error": "Gagal membuat akun employee"}), 500


@admin_api_bp.route('/api/admin/employees', methods=['PUT'])
@require_roles('phishing_admin')
def edit_employee():
    data = request.get_json(silent=True)
    if not data or 'old_email' not in data or 'email' not in data:
        return jsonify({"error": "old_email and email are required"}), 400
        
    divisi = data.get('divisi', 'Unknown')
    is_active = data.get('is_active', 1)
    
    try:
        auth_service.update_account(
            old_email=data['old_email'],
            email=data['email'],
            division=divisi,
            role=data.get('role', 'employee'),
            is_active=is_active,
            new_password=data.get('password') or None,
        )
        return jsonify({"message": "Employee dan akun berhasil diperbarui"}), 200
    except auth_service.AuthError as e:
        return jsonify({"error": e.message, "code": e.code}), e.status
    except Exception as e:
        return jsonify({"error": "Gagal memperbarui akun employee"}), 500


@admin_api_bp.route('/api/admin/divisions', methods=['GET'])
@require_roles('phishing_admin', 'grc', 'ciso')
def list_divisions():
    try:
        divisions = database.list_divisions()
        return jsonify({"divisions": divisions}), 200
    except Exception as e:
        return jsonify({"error": "Failed to list divisions", "detail": str(e)}), 500


@admin_api_bp.route('/api/admin/divisions', methods=['POST'])
@require_roles('phishing_admin')
def create_division():
    data = request.get_json(silent=True)
    if not data or 'name' not in data:
        return jsonify({"error": "Division name is required"}), 400
        
    try:
        database.create_division(data['name'])
        return jsonify({"message": "Division created successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Failed to create division", "detail": str(e)}), 500
