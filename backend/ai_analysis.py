"""
ai_analysis.py — Data Aggregator untuk fitur Behavioral AI.

Bertugas mengambil data dari SQLite (via database.py) dan memformatnya
menjadi structured context yang siap dikirim ke Gemini API.

Prinsip: modul ini HANYA baca data, tidak pernah write. Single responsibility.
"""

import database
import sqlite3
from datetime import datetime, timedelta
from typing import Optional


def _get_date_filter(days: int) -> str:
    """Hitung timestamp cutoff untuk filter query berdasarkan jumlah hari."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    return cutoff.isoformat()


def get_all_users_summary() -> list[dict]:
    """Ambil ringkasan semua user dari user_history untuk overview."""
    conn = database.get_connection()
    rows = conn.execute("""
        SELECT email, divisi, click_count, viewed_training_count,
               skipped_training_count, points, badge, last_clicked, updated_at
        FROM user_history
        WHERE divisi IS NOT NULL AND divisi != 'Unknown'
        ORDER BY points ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_events(email: str, days: int = 30) -> list[dict]:
    """Ambil log event mentah untuk user tertentu dalam rentang hari."""
    cutoff = _get_date_filter(days)
    conn = database.get_connection()
    rows = conn.execute("""
        SELECT event_type, tier_assigned, campaign_id, created_at
        FROM events
        WHERE email = ? AND created_at >= ?
        ORDER BY created_at DESC
    """, (email, cutoff)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_org_events(days: int = 7) -> list[dict]:
    """Ambil semua event organisasi dalam rentang hari untuk laporan agregat."""
    cutoff = _get_date_filter(days)
    conn = database.get_connection()
    rows = conn.execute("""
        SELECT email, divisi, event_type, created_at
        FROM events
        WHERE created_at >= ?
        ORDER BY created_at DESC
    """, (cutoff,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_incidents_by_divisi(divisi: str, days: int = 30) -> list[dict]:
    """Ambil incident terkait divisi user dalam rentang hari."""
    cutoff = _get_date_filter(days)
    conn = database.get_connection()
    rows = conn.execute("""
        SELECT ticket_id, source_type, reported_url, severity,
               vt_verdict, urlscan_verdict, status, created_at
        FROM incidents
        WHERE divisi = ? AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 10
    """, (divisi, cutoff)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_incidents(days: int = 30) -> list[dict]:
    """Ambil semua incident dalam rentang hari."""
    cutoff = _get_date_filter(days)
    conn = database.get_connection()
    rows = conn.execute("""
        SELECT ticket_id, source_type, divisi, severity, status, created_at
        FROM incidents
        WHERE created_at >= ?
        ORDER BY created_at DESC
    """, (cutoff,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def build_user_context(email: str, days: int = 30) -> Optional[dict]:
    """
    Bangun konteks lengkap satu user untuk dikirim ke Gemini.
    Return None kalau user tidak ditemukan.
    """
    history = database.get_user_history(email)
    if history.get("is_new_user"):
        return None

    events = get_user_events(email, days)
    incidents = get_incidents_by_divisi(history.get("divisi", "Unknown"), days)

    # Hitung metrik dari events dalam periode
    event_counts = {}
    for ev in events:
        t = ev["event_type"]
        event_counts[t] = event_counts.get(t, 0) + 1

    # Timeline ringkas (max 15 event terbaru)
    timeline = [
        {"date": ev["created_at"][:10], "type": ev["event_type"]}
        for ev in events[:15]
    ]

    # Tren: bandingkan 7 hari terakhir vs sebelumnya
    cutoff_7d = _get_date_filter(7)
    recent_clicks = sum(
        1 for ev in events
        if ev["event_type"] == "clicked_link" and ev["created_at"] >= cutoff_7d
    )
    old_clicks = sum(
        1 for ev in events
        if ev["event_type"] == "clicked_link" and ev["created_at"] < cutoff_7d
    )

    return {
        "email": email,
        "divisi": history.get("divisi", "Unknown"),
        "period_days": days,
        "summary": {
            "total_phishing_clicks": history.get("click_count", 0),
            "training_completed": history.get("viewed_training_count", 0),
            "training_skipped": history.get("skipped_training_count", 0),
            "gamification_points": history.get("points", 100),
            "current_badge": history.get("badge", "Guardian"),
            "last_phishing_click": history.get("last_clicked"),
        },
        "period_events": {
            "clicked_link": event_counts.get("clicked_link", 0),
            "submitted_data": event_counts.get("submitted_data", 0),
            "viewed_training": event_counts.get("viewed_training", 0),
            "skipped_training": event_counts.get("skipped_training", 0),
            "spot_the_fake_correct": event_counts.get("spot_the_fake_correct", 0),
            "spot_the_fake_incorrect": event_counts.get("spot_the_fake_incorrect", 0),
            "threat_reports": event_counts.get("confirmed_report", 0),
        },
        "trend": {
            "phishing_clicks_last_7d": recent_clicks,
            "phishing_clicks_before_7d": old_clicks,
            "direction": "WORSENING" if recent_clicks > old_clicks else (
                "IMPROVING" if recent_clicks < old_clicks else "STABLE"
            ),
        },
        "recent_timeline": timeline,
        "division_incidents": incidents[:5],
    }


def build_org_context(days: int = 7) -> dict:
    """
    Bangun konteks tingkat organisasi untuk laporan naratif.
    Menggabungkan semua user dan events dalam periode.
    """
    users = get_all_users_summary()
    all_events = get_org_events(days)
    all_incidents = get_all_incidents(days)

    # Statistik event per tipe
    event_totals = {}
    for ev in all_events:
        t = ev["event_type"]
        event_totals[t] = event_totals.get(t, 0) + 1

    # Breakdown per divisi
    divisi_stats = {}
    for u in users:
        d = u["divisi"] or "Unknown"
        if d not in divisi_stats:
            divisi_stats[d] = {
                "total_users": 0, "total_clicks": 0,
                "total_training": 0, "avg_points": 0,
                "points_list": []
            }
        divisi_stats[d]["total_users"] += 1
        divisi_stats[d]["total_clicks"] += u.get("click_count", 0)
        divisi_stats[d]["total_training"] += u.get("viewed_training_count", 0)
        divisi_stats[d]["points_list"].append(u.get("points", 100))

    for d, stats in divisi_stats.items():
        pts = stats.pop("points_list")
        stats["avg_points"] = round(sum(pts) / len(pts), 1) if pts else 100

    # Klasifikasi user berdasarkan badge existing
    risk_distribution = {
        "SAFE": sum(1 for u in users if u.get("badge") == "Sentinel"),
        "MODERATE": sum(1 for u in users if u.get("badge") == "Guardian"),
        "HIGH_RISK": sum(1 for u in users if u.get("badge") == "Vulnerable"),
    }

    # Identifikasi chronic clickers
    chronic_users = [
        {"email": u["email"], "divisi": u["divisi"], "clicks": u["click_count"]}
        for u in users if u.get("click_count", 0) >= 4
    ]

    return {
        "period_days": days,
        "total_employees": len(users),
        "risk_distribution": risk_distribution,
        "event_totals": event_totals,
        "divisi_breakdown": divisi_stats,
        "total_incidents": len(all_incidents),
        "open_incidents": sum(1 for i in all_incidents if i.get("status") == "open"),
        "high_severity_incidents": sum(1 for i in all_incidents if i.get("severity") == "high"),
        "chronic_risk_users": chronic_users,
        "avg_org_points": round(
            sum(u.get("points", 100) for u in users) / len(users), 1
        ) if users else 100,
    }
