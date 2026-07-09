"""
test_gamification_manual.py — validasi manual 8 test case dari api_contract.md
SEBELUM lanjut ke routes layer.

Cara pakai:
1. Taruh file ini di folder backend/ (sejajar sama database.py)
2. Jalanin: python test_gamification_manual.py
3. Baca output — tiap test case bakal print PASS/FAIL

Catatan: script ini pakai email dummy yang di-cleanup di awal & akhir,
supaya bisa di-run berkali-kali tanpa nyampah data test ke database asli.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database as db
from datetime import date, timedelta

TEST_EMAIL = "test_gamification_dummy@example.com"
TEST_DIVISI = "QA_Test"

results = []


def check(label, condition, detail=""):
    status = "✅ PASS" if condition else "❌ FAIL"
    results.append((label, condition))
    print(f"{status} — {label}" + (f" ({detail})" if detail else ""))


def cleanup():
    """Hapus semua jejak test dummy dari database."""
    conn = db.get_connection()
    try:
        conn.execute("DELETE FROM threat_reports WHERE email = ?", (TEST_EMAIL,))
        conn.execute("DELETE FROM daily_events WHERE email = ?", (TEST_EMAIL,))
        conn.execute("DELETE FROM user_history WHERE email = ?", (TEST_EMAIL,))
        conn.commit()
    finally:
        conn.close()


def setup_employee():
    """Bikin employee dummy dari nol."""
    conn = db.get_connection()
    try:
        conn.execute(
            "INSERT INTO user_history (email, divisi, click_count) VALUES (?, ?, 0)",
            (TEST_EMAIL, TEST_DIVISI)
        )
        conn.commit()
    finally:
        conn.close()


def set_last_quiz_date(days_ago):
    """Helper: paksa last_quiz_completed_at & daily_streak ke state tertentu,
    buat simulasi skenario 'kemarin' atau 'bolong beberapa hari'."""
    target_date = (date.today() - timedelta(days=days_ago)).isoformat()
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE user_history SET last_quiz_completed_at = ? WHERE email = ?",
            (target_date, TEST_EMAIL)
        )
        conn.commit()
    finally:
        conn.close()


def force_streak(value):
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE user_history SET daily_streak = ? WHERE email = ?",
            (value, TEST_EMAIL)
        )
        conn.commit()
    finally:
        conn.close()


def clear_today_quiz_event():
    """Hapus event quiz hari ini biar bisa re-test complete_daily_quiz()
    berkali-kali dalam satu run tanpa kena 'already_completed'."""
    conn = db.get_connection()
    try:
        conn.execute(
            "DELETE FROM daily_events WHERE email = ? AND event_type = 'quiz_completed'",
            (TEST_EMAIL,)
        )
        conn.commit()
    finally:
        conn.close()


print("=" * 70)
print("SETUP: cleanup dulu (in case ada sisa run sebelumnya), lalu bikin employee baru")
print("=" * 70)
cleanup()
setup_employee()

# -----------------------------------------------------------------------
# Test 1: Malicious report, target baru -> counted, counter +1
# -----------------------------------------------------------------------
print("\n--- Test 1: Malicious report, target baru ---")
r1 = db.create_threat_report(
    email=TEST_EMAIL, telegram_user_id="tg_001", type_="url",
    target="http://evil-test-1.example", verdict="malicious",
    severity_tier="high", source_engine="vt"
)
check("counted_for_gamification == True", r1["counted_for_gamification"] is True)
check("dedupe_status == 'new'", r1["dedupe_status"] == "new")
check("reports_count_malicious == 1", r1["employee"]["reports_count_malicious"] == 1,
      f"got {r1['employee']['reports_count_malicious']}")
check("badge_just_unlocked == 'sentinel_troops'",
      r1["employee"]["badge_just_unlocked"] == "sentinel_troops")

# -----------------------------------------------------------------------
# Test 2: Clean verdict -> not counted, counter tidak naik
# -----------------------------------------------------------------------
print("\n--- Test 2: Clean verdict ---")
r2 = db.create_threat_report(
    email=TEST_EMAIL, telegram_user_id="tg_001", type_="url",
    target="http://clean-test.example", verdict="clean",
    severity_tier=None, source_engine="vt"
)
check("counted_for_gamification == False", r2["counted_for_gamification"] is False)
check("reports_count_malicious tetap 1 (tidak naik)",
      r2["employee"]["reports_count_malicious"] == 1,
      f"got {r2['employee']['reports_count_malicious']}")

# -----------------------------------------------------------------------
# Test 3: Duplicate malicious (target sama dengan Test 1) -> dedupe
# -----------------------------------------------------------------------
print("\n--- Test 3: Duplicate malicious report (target sama kaya Test 1) ---")
r3 = db.create_threat_report(
    email=TEST_EMAIL, telegram_user_id="tg_001", type_="url",
    target="http://evil-test-1.example", verdict="malicious",
    severity_tier="high", source_engine="urlscan"
)
check("dedupe_status == 'duplicate'", r3["dedupe_status"] == "duplicate")
check("counted_for_gamification == False", r3["counted_for_gamification"] is False)
check("reports_count_malicious tetap 1 (tidak naik karena duplicate)",
      r3["employee"]["reports_count_malicious"] == 1,
      f"got {r3['employee']['reports_count_malicious']}")

# Cek reports_count_total naik walau duplicate (Gap fix)
summary_after_3 = db.get_reports_summary(TEST_EMAIL)
check("reports_count_total == 3 (semua row masuk, termasuk clean & duplicate)",
      summary_after_3["reports_count_total"] == 3,
      f"got {summary_after_3['reports_count_total']}")

# -----------------------------------------------------------------------
# Test 4: Employee not found -> ValueError
# -----------------------------------------------------------------------
print("\n--- Test 4: Employee tidak ditemukan ---")
try:
    db.create_threat_report(
        email="nonexistent_ghost@example.com", telegram_user_id="tg_999",
        type_="url", target="http://whatever.example", verdict="malicious",
        severity_tier="high", source_engine="vt"
    )
    check("ValueError ter-raise untuk employee tidak ditemukan", False, "malah gak error")
except ValueError:
    check("ValueError ter-raise untuk employee tidak ditemukan", True)
except Exception as e:
    check("ValueError ter-raise untuk employee tidak ditemukan", False,
          f"malah dapet {type(e).__name__}: {e}")

# -----------------------------------------------------------------------
# Test 5: Badge trigger di laporan ke-5 (malicious count nyampe threshold)
# -----------------------------------------------------------------------
print("\n--- Test 5: Badge trigger pas nyampe threshold ---")
# udah punya 1 malicious dari Test 1. Tambah 4 lagi (target beda-beda) buat nyampe 5.
badge_hit = None
for i in range(2, 6):  # laporan ke-2 s.d. ke-5
    res = db.create_threat_report(
        email=TEST_EMAIL, telegram_user_id="tg_001", type_="url",
        target=f"http://evil-test-{i}.example", verdict="malicious",
        severity_tier="high", source_engine="vt"
    )
    if res["employee"]["badge_just_unlocked"]:
        badge_hit = (res["employee"]["reports_count_malicious"], res["employee"]["badge_just_unlocked"])

check("badge 'front_line_defender' unlocked pas count == 3",
      badge_hit is not None, f"badge terakhir unlocked: {badge_hit}")
final_count = db.get_reports_summary(TEST_EMAIL)["reports_count_malicious"]
check("reports_count_malicious == 5 setelah 5 laporan unik",
      final_count == 5, f"got {final_count}")

# -----------------------------------------------------------------------
# Test 6: New employee -> semua badge false, next_badge = threshold terendah
# -----------------------------------------------------------------------
print("\n--- Test 6: Summary untuk employee baru (belum pernah lapor) ---")
fresh_email = "test_fresh_dummy@example.com"
conn = db.get_connection()
try:
    conn.execute("DELETE FROM user_history WHERE email = ?", (fresh_email,))
    conn.execute("INSERT INTO user_history (email, divisi, click_count) VALUES (?, ?, 0)",
                 (fresh_email, TEST_DIVISI))
    conn.commit()
finally:
    conn.close()

fresh_summary = db.get_reports_summary(fresh_email)
check("semua badge achieved == False",
      all(b["achieved"] is False for b in fresh_summary["badges"]))
check("next_badge threshold == 1 (sentinel_troops)",
      fresh_summary["next_badge"]["threshold"] == 1,
      f"got {fresh_summary['next_badge']}")

conn = db.get_connection()
try:
    conn.execute("DELETE FROM user_history WHERE email = ?", (fresh_email,))
    conn.commit()
finally:
    conn.close()

# -----------------------------------------------------------------------
# Test 7: Quiz dua kali di hari yang sama -> completed lalu already_completed
# -----------------------------------------------------------------------
print("\n--- Test 7: Quiz completion dua kali hari yang sama ---")
clear_today_quiz_event()
force_streak(0)
conn = db.get_connection()
try:
    conn.execute("UPDATE user_history SET last_quiz_completed_at = NULL WHERE email = ?", (TEST_EMAIL,))
    conn.commit()
finally:
    conn.close()

q1 = db.complete_daily_quiz(TEST_EMAIL)
check("completion pertama -> status 'completed'", q1["status"] == "completed")
check("streak == 1 setelah completion pertama (dari None)",
      q1["daily_streak"] == 1, f"got {q1['daily_streak']}")

q2 = db.complete_daily_quiz(TEST_EMAIL)
check("completion kedua hari sama -> status 'already_completed'",
      q2["status"] == "already_completed")
check("streak tidak nambah lagi di completion kedua",
      q2["daily_streak"] == 1, f"got {q2['daily_streak']}")

# -----------------------------------------------------------------------
# Test 8 (NEW): Streak continuity — lanjut kalau kemarin, reset kalau bolong
# -----------------------------------------------------------------------
print("\n--- Test 8: Streak logic (lanjut vs reset) ---")

# 8a: simulasi udah quiz "kemarin" dengan streak sebelumnya 2 -> hari ini harus jadi 3
clear_today_quiz_event()
force_streak(2)
set_last_quiz_date(days_ago=1)
q3 = db.complete_daily_quiz(TEST_EMAIL)
check("8a: completion setelah 'kemarin' -> streak lanjut (2 -> 3)",
      q3["daily_streak"] == 3, f"got {q3['daily_streak']}")

# 8b: simulasi bolong 3 hari dengan streak sebelumnya 3 -> harus reset ke 1
clear_today_quiz_event()
force_streak(3)
set_last_quiz_date(days_ago=3)
q4 = db.complete_daily_quiz(TEST_EMAIL)
check("8b: completion setelah bolong 3 hari -> streak reset ke 1",
      q4["daily_streak"] == 1, f"got {q4['daily_streak']}")

# -----------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------
print("\n" + "=" * 70)
total = len(results)
passed = sum(1 for _, ok in results if ok)
print(f"HASIL: {passed}/{total} test PASS")
if passed < total:
    print("Test yang FAIL:")
    for label, ok in results:
        if not ok:
            print(f"  - {label}")
print("=" * 70)

print("\nCLEANUP: menghapus semua data dummy...")
cleanup()
print("Selesai. Database bersih dari data test.")

if passed < total:
    sys.exit(1)