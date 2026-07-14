from flask import Blueprint
from flask import render_template
from flask import request
from flask import redirect

from services.threat_service import analyze_indicator

proxy_bp = Blueprint(
    "proxy",
    __name__
)


@proxy_bp.route("/visit")
def visit():

    return render_template("visit.html")


@proxy_bp.route("/go", methods=["POST"])
def go():

    url = request.form.get("url", "").strip()

    if not url:

        return render_template(
            "visit.html",
            error="URL wajib diisi."
        )

    result = analyze_indicator(url)

    action = result["policy"]["action"]

    if action == "allow":

        return redirect(url)

    return redirect("/blocked")
@proxy_bp.route("/blocked")
def blocked():

    return render_template(
        "blocked.html"
    )