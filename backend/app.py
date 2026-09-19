"""
app.py — Flask API untuk Human Firewall Lite.
"""

from flask import Flask, g, request, jsonify, render_template, redirect
from flask_cors import CORS
import database
import os
from dotenv import load_dotenv
from security import (
    env_flag,
    authenticate_session_request,
    is_local_development,
    is_valid_service_request,
    validate_runtime_security,
)

# Load environment variables from .env file
load_dotenv()
validate_runtime_security()

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

# CORS Whitelist configuration. During local development both loopback aliases
# are accepted because browser cookies are host-scoped: localhost and
# 127.0.0.1 are different cookie domains even when they reach the same machine.
allowed_origins = [
    origin.strip()
    for origin in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
    if origin.strip()
]
if is_local_development():
    allowed_origins = list(dict.fromkeys([
        *allowed_origins,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]))
CORS(
    app,
    origins=allowed_origins,
    supports_credentials=True,
)

# Initialize database on startup
database.init_db()

# The proxy data plane is deliberately isolated from the legacy SQLite
# application database. When enabled, PostgreSQL and Redis are mandatory so a
# partially initialized proxy can never silently accept traffic.
if env_flag('PROXY_FEATURE_ENABLED'):
    from services.proxy_service import validate_runtime_configuration
    from services.proxy_store import init_proxy_runtime
    validate_runtime_configuration()
    init_proxy_runtime()

# Ensure there is one server-side RBAC account for the existing administrator.
# This is idempotent and only uses ADMIN_PASSWORD during the one-time bootstrap.
from services.auth_service import ensure_bootstrap_admin
ensure_bootstrap_admin()

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

# Public endpoints are deny-by-default. Entries below either perform their own
# resource-level token validation or must be reachable before authentication.
PUBLIC_ROUTES = {
    'events.redirect_handler', 'events.fake_login_submit',
    'events.save_event', 'events.user_profile',
    'auth.admin_login', 'auth.admin_logout', 'health', 'static',
    'auth.login', 'auth.verify_otp', 'auth.resend_otp', 'auth.logout',
    'auth.retired_auth_flow',
    'proxy.retired_manual_proxy', 'proxy.blocked', 'proxy.ml_verdict_webhook',
    'proxy.download_ca_cert',
}

@app.before_request
def require_authenticated_request():
    """Deny-by-default authentication gate for every non-public route."""
    g.auth_identity = None
    g.service_authenticated = False

    # A credentialed cross-origin POST first sends a cookie-less OPTIONS
    # preflight. It performs no application action and must reach Flask's
    # automatic OPTIONS handler so Flask-CORS can return the allow headers.
    # The subsequent POST is still authenticated and RBAC-protected below.
    if request.method == 'OPTIONS':
        return

    if is_local_development() and env_flag('DEV_BYPASS_AUTH'):
        return

    if request.endpoint and request.endpoint not in PUBLIC_ROUTES:
        # User requests carry an opaque database-backed session forwarded by
        # the same-origin Next.js BFF. It is evaluated before service auth so
        # an end-user request always retains its real RBAC identity.
        identity = authenticate_session_request(request)
        if identity:
            g.auth_identity = identity
            return

        # Service keys remain reserved for internal n8n/backend integration.
        if is_valid_service_request(request):
            g.service_authenticated = True
            return

        if request.path.startswith('/api/'):
            return jsonify({"error": "Unauthorized", "code": "UNAUTHORIZED"}), 401
        dashboard_base = os.environ.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
        return redirect(f"{dashboard_base}/auth")

@app.route('/')
def dashboard():
    return render_template('dashboard.html')

@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
