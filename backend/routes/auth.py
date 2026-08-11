from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import os

auth_bp = Blueprint('auth', __name__)

# Fetch ADMIN_PASSWORD in blueprint to avoid circular imports
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Login page for SOC Dashboard. GET = show form, POST = validate password."""
    if request.method == 'GET':
        # Already logged in? Go straight to dashboard.
        if session.get('is_admin'):
            return redirect(url_for('dashboard'))
        return render_template('admin_login.html', error=None)

    # POST — validate password
    password = request.form.get('password', '')
    if password == ADMIN_PASSWORD:
        session['is_admin'] = True
        return redirect(url_for('dashboard'))
    else:
        return render_template('admin_login.html', error='Password salah. Coba lagi.'), 401


@auth_bp.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('auth.admin_login'))


@auth_bp.route('/api/auth/admin', methods=['POST'])
def api_auth_admin():
    """Verify admin password and return user object if valid."""
    data = request.get_json(silent=True)
    if not data or 'password' not in data:
        return jsonify({"error": "Password wajib diisi"}), 400

    if data['password'] == ADMIN_PASSWORD:
        return jsonify({
            "success": True,
            "user": {
                "email": "admin@humanfirewall.local",
                "userName": "SOC Administrator",
                "division": "SOC Team",
                "telegramId": "",
                "role": "admin"
            }
        }), 200
    else:
        return jsonify({"error": "Password salah"}), 401
