"""
gamification_routes.py — 3 endpoint gamifikasi sesuai api_contract.md.

Dipisah jadi Blueprint sendiri (bukan ditumpuk ke app.py langsung) supaya
gampang di-review terpisah dan gak nyampur sama route existing (incidents,
OTP, dll). Tinggal registrasi ke Flask app utama:

    from gamification_routes import gamification_bp
    app.register_blueprint(gamification_bp)

Semua business logic (dedupe, badge, streak) TETAP di database.py —
file ini cuma: terima request -> validasi -> panggil database.py ->
convert ke response/HTTP status sesuai contract. Sengaja tipis.
"""

from flask import Blueprint, request, jsonify

import database as db

gamification_bp = Blueprint("gamification", __name__, url_prefix="/api")

# CATATAN AUTH:
# - POST /reports: SENGAJA tidak dimasukkan ke PUBLIC_ROUTES di app.py,
#   jadi otomatis kena guard global app.py yang mewajibkan
#   "Authorization: Bearer <SERVICE_API_KEY>" (server-to-server, dipanggil n8n).
#
# - GET /employee/<id>/reports-summary dan POST /quiz/complete: endpoint
#   ini DIPANGGIL LANGSUNG dari browser employee (via Next.js dashboard),
#   jadi mereka ADA di PUBLIC_ROUTES di app.py (supaya lolos dari guard
#   admin/n8n). Karena itu, auth-nya HARUS divalidasi manual di sini,
#   pakai dashboard_token (bukan admin Bearer, bukan session admin) —
#   lihat _authenticate_employee() di bawah. Endpoint ini menolak request
#   tanpa token, dan menolak token yang valid tapi milik employee lain
#   (mencegah IDOR: employee A tidak bisa lihat/ubah data employee B
#   hanya dengan menebak/mengetahui email B).


def error_response(status_code, code, message):
    """Bikin response error sesuai envelope yang disepakati di contract:
    { "error": { "code": ..., "message": ... } }"""
    return jsonify({"error": {"code": code, "message": message}}), status_code


def _authenticate_employee(requested_employee_id: str):
    """Validasi dashboard_token milik employee yang sedang akses dashboard.

    Token diterima dari query param `?token=` (dipakai GET) ATAU dari body
    JSON `{"token": ...}` (dipakai POST), supaya satu helper ini bisa
    dipakai di kedua endpoint tanpa duplikasi logic.

    Selain validasi token itu sendiri (ada / belum expired), kita WAJIB
    cross-check bahwa email hasil validasi token == employee_id yang
    diminta di path/body. Tanpa cross-check ini, token employee A yang
    valid tetap bisa dipakai buat baca/tulis data employee B — jadi
    token doang gak cukup, harus token YANG COCOK sama resource yang
    diminta.

    Return (validated_email, None) kalau lolos, atau
           (None, <flask response error>) kalau gagal — caller tinggal
           `return err` kalau err bukan None.
    """
    token = request.args.get("token")
    if not token and request.is_json:
        body = request.get_json(silent=True) or {}
        token = body.get("token")

    if not token:
        return None, error_response(
            401, "UNAUTHORIZED", "Token dashboard wajib disertakan"
        )

    validated_email = db.validate_dashboard_token(token)
    if not validated_email:
        return None, error_response(
            401, "UNAUTHORIZED", "Token tidak valid atau sudah kadaluarsa"
        )

    if requested_employee_id and validated_email != requested_employee_id:
        # Token sah, tapi bukan milik employee yang datanya diminta —
        # ini persis skenario IDOR yang mau dicegah.
        return None, error_response(
            403, "FORBIDDEN", "Token tidak cocok dengan employee_id yang diminta"
        )

    return validated_email, None


# ---------------------------------------------------------------------------
# POST /api/reports — dipanggil n8n di ujung Flow B setelah triase VT+urlscan
# ---------------------------------------------------------------------------

@gamification_bp.route("/reports", methods=["POST"])
def post_report():
    # Tidak butuh token check manual di sini — endpoint ini SENGAJA tidak
    # dimasukkan ke PUBLIC_ROUTES di app.py, jadi otomatis kena guard global
    # yang mewajibkan "Authorization: Bearer <SERVICE_API_KEY>" dari n8n.

    body = request.get_json(silent=True)
    if not body:
        return error_response(400, "INVALID_PAYLOAD", "Body request kosong atau bukan JSON valid")

    # Validasi field required sesuai contract section 1.1
    required_fields = ["employee_id", "telegram_user_id", "type", "target",
                        "verdict", "source_engine", "submitted_at"]
    missing = [f for f in required_fields if f not in body or body[f] in (None, "")]
    if missing:
        return error_response(
            400, "INVALID_PAYLOAD",
            f"Field wajib belum diisi: {', '.join(missing)}"
        )

    try:
        from services.threat_service import reconcile_report_source
        source_verdict = reconcile_report_source(body["target"], body["verdict"])

        result = db.create_threat_report(
            email=body["employee_id"],
            telegram_user_id=body["telegram_user_id"],
            type_=body["type"],
            target=body["target"],
            verdict=body["verdict"],
            severity_tier=body.get("severity_tier"),
            source_engine=body["source_engine"],
            raw_scores=body.get("raw_scores"),
            submitted_at=body["submitted_at"],
        )
        result["source_verdict"] = source_verdict
        return jsonify(result), 201

    except ValueError as e:
        msg = str(e)
        # create_threat_report() raise ValueError untuk 2 kasus berbeda:
        # employee tidak ditemukan (404) vs field enum tidak valid (400).
        # Dibedakan dari isi pesannya supaya status code-nya tepat.
        if "tidak ditemukan" in msg:
            return error_response(404, "EMPLOYEE_NOT_FOUND", msg)
        return error_response(400, "INVALID_PAYLOAD", msg)

    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", f"Gagal menyimpan laporan: {e}")


# ---------------------------------------------------------------------------
# GET /api/employee/{employee_id}/reports-summary — dipanggil Dashboard
# ---------------------------------------------------------------------------

@gamification_bp.route("/employee/<path:employee_id>/reports-summary", methods=["GET"])
def get_employee_reports_summary(employee_id):
    validated_email, err = _authenticate_employee(employee_id)
    if err:
        return err

    try:
        # Pakai validated_email (hasil token), BUKAN employee_id mentah dari
        # path — walaupun secara logic keduanya udah dipastikan sama di
        # _authenticate_employee(), ini best practice defense-in-depth:
        # identity selalu diturunkan dari token, bukan dari input user.
        summary = db.get_reports_summary(validated_email)
    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", f"Gagal mengambil summary: {e}")

    if summary is None:
        return error_response(404, "EMPLOYEE_NOT_FOUND", f"Employee {employee_id} tidak ditemukan")

    return jsonify(summary), 200


# ---------------------------------------------------------------------------
# POST /api/quiz/complete — dipanggil frontend saat user selesai kuis harian
# ---------------------------------------------------------------------------

@gamification_bp.route("/quiz/complete", methods=["POST"])
def post_quiz_complete():
    body = request.get_json(silent=True)
    if not body or "employee_id" not in body or not body["employee_id"]:
        return error_response(400, "INVALID_PAYLOAD", "Field 'employee_id' wajib diisi")

    requested_employee_id = body["employee_id"]

    validated_email, err = _authenticate_employee(requested_employee_id)
    if err:
        return err

    try:
        question_id = body.get("question_id")
        selected_option_index = body.get("selected_option_index")

        result = db.complete_daily_quiz(
            validated_email,
            question_id=int(question_id) if question_id is not None else None,
            selected_option_index=int(selected_option_index) if selected_option_index is not None else None
        )
        # Sesuai contract 3.3: ini "expected state", bukan error, jadi
        # tetap 200 baik status-nya "completed" maupun "already_completed".
        return jsonify(result), 200

    except ValueError as e:
        return error_response(404, "EMPLOYEE_NOT_FOUND", str(e))

    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", f"Gagal memproses quiz completion: {e}")


# ---------------------------------------------------------------------------
# GET /api/quiz/today — serve 1 deterministic daily question for employee
# ---------------------------------------------------------------------------

@gamification_bp.route("/quiz/today", methods=["GET"])
def get_quiz_today():
    employee_id = request.args.get("employee_id")
    if not employee_id:
        return error_response(400, "INVALID_PAYLOAD", "Parameter 'employee_id' wajib diisi")

    validated_email, err = _authenticate_employee(employee_id)
    if err:
        return err

    try:
        question = db.get_daily_question(validated_email)
        if question is None:
            return error_response(404, "QUESTION_NOT_FOUND", "Tidak ada pertanyaan kuis yang tersedia")
        return jsonify(question), 200
    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", f"Gagal mengambil kuis harian: {e}")


# ---------------------------------------------------------------------------
# POST /api/quiz/revive — memulihkan kuis streak yang terputus hari ini
# ---------------------------------------------------------------------------

@gamification_bp.route("/quiz/revive", methods=["POST"])
def post_quiz_revive():
    body = request.get_json(silent=True)
    if not body or "employee_id" not in body or not body["employee_id"]:
        return error_response(400, "INVALID_PAYLOAD", "Field 'employee_id' wajib diisi")

    requested_employee_id = body["employee_id"]
    validated_email, err = _authenticate_employee(requested_employee_id)
    if err:
        return err

    try:
        result = db.revive_quiz_streak(validated_email)
        return jsonify(result), 200

    except ValueError as e:
        return error_response(400, "REVIVE_FAILED", str(e))

    except Exception as e:
        return error_response(500, "INTERNAL_ERROR", f"Gagal memproses revive: {e}")