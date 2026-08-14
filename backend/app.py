"""
app.py — Flask API untuk Human Firewall Lite.
"""

from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
import database
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from routes.threat import threat_bp
from routes.proxy import proxy_bp

# Admin password, Flask session secret, and internal service key checks on startup
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
SECRET_KEY = os.environ.get('SECRET_KEY')
SERVICE_API_KEY = os.environ.get('SERVICE_API_KEY')
if not ADMIN_PASSWORD:
    raise RuntimeError("CRITICAL ERROR: Environment variable 'ADMIN_PASSWORD' is not set! Flask application refuses to start.")
if not SECRET_KEY:
    raise RuntimeError("CRITICAL ERROR: Environment variable 'SECRET_KEY' is not set! Flask application refuses to start.")
if not SERVICE_API_KEY:
    raise RuntimeError("CRITICAL ERROR: Environment variable 'SERVICE_API_KEY' is not set! Flask application refuses to start.")

app = Flask(__name__)
app.secret_key = SECRET_KEY

# CORS Whitelist configuration
CORS(app, origins=os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(','))

# Initialize database on startup
database.init_db()

# Initialize AI cache table (must run AFTER database.init_db creates the DB)
import ai_cache
ai_cache.init_cache_table()

# Register blueprints
from routes.auth import auth_bp
from routes.events import events_bp
from routes.incidents import incidents_bp
from routes.admin_api import admin_api_bp
from gamification_routes import gamification_bp
from routes.ai_routes import ai_bp  # AI Behavioral Engine

app.register_blueprint(auth_bp)
app.register_blueprint(events_bp)
app.register_blueprint(incidents_bp)
app.register_blueprint(admin_api_bp)
app.register_blueprint(gamification_bp)
app.register_blueprint(threat_bp)
app.register_blueprint(proxy_bp)
app.register_blueprint(ai_bp)  # AI Behavioral: /api/ai/*

# Public endpoints whitelisting (matching blueprint endpoint paths)
# /api/telegram/user is deliberately excluded to prevent sensitive data exposure
PUBLIC_ROUTES = {
    'events.redirect_handler', 'events.fake_login_submit', 'events.save_event',
    'events.get_user_history', 'events.user_profile', 'events.create_otp', 'events.verify_otp',
    'events.register_telegram', 'events.list_emails', 'auth.admin_login', 'health',
    'static', 'auth.api_auth_admin', 'events.api_user_eligibility', 'events.api_user_activity',
    'events.dns_check',
    'gamification.get_employee_reports_summary',
    'gamification.post_quiz_complete',
    'gamification.get_quiz_today',
    'gamification.post_quiz_revive',
    'auth.validate_token_api',
    'auth.telegram_command',
    'proxy.visit', 'proxy.go', 'proxy.blocked',
    'ai.classify_all_users', 'ai.analyze_user', 'ai.generate_org_report',
    'ai.invalidate_ai_cache', 'ai.cache_stats', 'ai.agentic_investigate',
    'ai.gophish_generate', 'ai.router_status', 'ai.get_agentic_history'
}

@app.before_request
def require_admin_for_protected_routes():
    """Guard: redirect ke login page atau return 401 kalau belum autentikasi.
    Hanya berlaku untuk route yang TIDAK ada di PUBLIC_ROUTES."""
    dev_bypass = os.environ.get('DEV_BYPASS_AUTH', 'false').lower() == 'true'
    if dev_bypass:
        return

    if request.endpoint and request.endpoint not in PUBLIC_ROUTES:
        auth_header = request.headers.get('Authorization')
        
        # 1. Cek dedicated service API key untuk server-to-server (Next.js / n8n)
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            if token == SERVICE_API_KEY:
                return

        # 2. Cek session cookie for legacy admin dashboard
        if session.get('is_admin'):
            return

        # 3. Return 401 JSON untuk endpoint API, atau 302 redirect untuk page biasa
        if request.path.startswith('/api/'):
            return jsonify({"error": "Unauthorized"}), 401
        dashboard_base = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
        return redirect(f"{dashboard_base}/admin/login")

@app.route('/')
def dashboard():
    return render_template('dashboard.html')

@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
