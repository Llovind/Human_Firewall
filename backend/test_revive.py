import sys
import os
import sqlite3
from datetime import datetime, date, timedelta

# Set paths
sys.path.append(os.path.dirname(__file__))
import database as db

# Use the test helper or standard database path
db.DB_PATH = os.path.join('instance', 'human_firewall.db')

def check(label, condition):
    if condition:
        print(f"✅ PASS — {label}")
    else:
        print(f"❌ FAIL — {label}")
        sys.exit(1)

def run_tests():
    print("======================================================================")
    print("RUNNING STREAK REVIVE UNIT TESTS")
    print("======================================================================")

    email = "test.revive@infranexia-dummy.local"
    divisi = "IT"

    # Initialize db to trigger ALTER TABLE migrations
    db.init_db()

    # Setup database with clean state for test user
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_history WHERE email = ?", (email,))
    cursor.execute("DELETE FROM daily_events WHERE email = ?", (email,))
    
    # Create the test user with 5 streak and 3 revives remaining for current month
    current_month = date.today().strftime('%Y-%m')
    cursor.execute('''
        INSERT INTO user_history (email, divisi, daily_streak, last_quiz_completed_at, quiz_revives_remaining, quiz_revives_month, streak_before_break, points)
        VALUES (?, ?, 5, ?, 3, ?, 0, 100)
    ''', (email, divisi, (date.today() - timedelta(days=1)).isoformat(), current_month))
    conn.commit()
    conn.close()

    # Get question 1 (Phishing)
    # The correct index for question 1 in our seed list is 1
    # We will submit selected_option_index = 0 to make it incorrect.
    
    print("\n--- Test 1: Wrong Answer resets streak to 0 and stores streak_before_break = 5 ---")
    res1 = db.complete_daily_quiz(email, question_id=1, selected_option_index=0)
    
    check("status == 'completed'", res1["status"] == "completed")
    check("correct == False", res1["correct"] is False)
    check("points_awarded == 0", res1["points_awarded"] == 0)
    check("daily_streak is reset to 0", res1["daily_streak"] == 0)
    check("revive_available == True", res1["revive_available"] is True)
    check("revives_remaining == 3", res1["revives_remaining"] == 3)
    check("streak_before_break == 5", res1["streak_before_break"] == 5)

    # Let's inspect DB
    conn = db.get_connection()
    row = conn.execute("SELECT daily_streak, streak_before_break FROM user_history WHERE email = ?", (email,)).fetchone()
    check("DB daily_streak == 0", row["daily_streak"] == 0)
    check("DB streak_before_break == 5", row["streak_before_break"] == 5)
    conn.close()

    print("\n--- Test 2: Successful Revive restores streak to 6 and consumes 1 token ---")
    res2 = db.revive_quiz_streak(email)
    check("status == 'revived'", res2["status"] == "revived")
    check("daily_streak is restored to 6 (5 + 1)", res2["daily_streak"] == 6)
    check("revives_remaining is decremented to 2", res2["revives_remaining"] == 2)

    # Let's inspect DB
    conn = db.get_connection()
    row = conn.execute("SELECT daily_streak, streak_before_break, quiz_revives_remaining FROM user_history WHERE email = ?", (email,)).fetchone()
    check("DB daily_streak == 6", row["daily_streak"] == 6)
    check("DB streak_before_break == 0 (reset to prevent multiple revives)", row["streak_before_break"] == 0)
    check("DB quiz_revives_remaining == 2", row["quiz_revives_remaining"] == 2)
    conn.close()

    print("\n--- Test 3: Double Reviving raises ValueError (no historic streak to save) ---")
    # Reset daily_streak to 0 manually to simulate post-revive failure state
    conn = db.get_connection()
    conn.execute("UPDATE user_history SET daily_streak = 0 WHERE email = ?", (email,))
    conn.commit()
    conn.close()

    try:
        db.revive_quiz_streak(email)
        check("Double revive allowed (BUG)", False)
    except ValueError as e:
        check("Double revive raises: " + str(e), "Tidak ada nilai streak historis" in str(e))

    print("\n--- Test 4: Reviving old break (e.g. break happened yesterday) raises ValueError ---")
    # Setup user with break yesterday
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_history WHERE email = ?", (email,))
    cursor.execute("DELETE FROM daily_events WHERE email = ?", (email,))
    cursor.execute('''
        INSERT INTO user_history (email, divisi, daily_streak, last_quiz_completed_at, quiz_revives_remaining, quiz_revives_month, streak_before_break)
        VALUES (?, ?, 0, ?, 3, ?, 8)
    ''', (email, divisi, (date.today() - timedelta(days=1)).isoformat(), current_month))
    conn.commit()
    conn.close()

    try:
        db.revive_quiz_streak(email)
        check("Revive old break allowed (BUG)", False)
    except ValueError as e:
        check("Old break revive raises: " + str(e), "Revive hanya bisa dilakukan di hari yang sama" in str(e))

    print("\n--- Test 5: Out of revive tokens (remaining == 0) disables revive_available ---")
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_history WHERE email = ?", (email,))
    cursor.execute("DELETE FROM daily_events WHERE email = ?", (email,))
    cursor.execute('''
        INSERT INTO user_history (email, divisi, daily_streak, last_quiz_completed_at, quiz_revives_remaining, quiz_revives_month, streak_before_break)
        VALUES (?, ?, 10, ?, 0, ?, 0)
    ''', (email, divisi, (date.today() - timedelta(days=1)).isoformat(), current_month))
    conn.commit()
    conn.close()

    res5 = db.complete_daily_quiz(email, question_id=1, selected_option_index=0)
    check("revive_available == False", res5["revive_available"] is False)
    check("revives_remaining == 0", res5["revives_remaining"] == 0)

    try:
        db.revive_quiz_streak(email)
        check("Revive with 0 tokens allowed (BUG)", False)
    except ValueError as e:
        check("0 tokens revive raises: " + str(e), "Kuota revive token Anda untuk bulan ini sudah habis" in str(e))

    print("\n--- Test 6: Dynamic Monthly Reset restores tokens to 3 ---")
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_history WHERE email = ?", (email,))
    cursor.execute("DELETE FROM daily_events WHERE email = ?", (email,))
    # Set revives_month to last month (June) and remaining to 0
    cursor.execute('''
        INSERT INTO user_history (email, divisi, daily_streak, last_quiz_completed_at, quiz_revives_remaining, quiz_revives_month, streak_before_break)
        VALUES (?, ?, 10, ?, 0, '2026-06', 0)
    ''', (email, divisi, (date.today() - timedelta(days=1)).isoformat()))
    conn.commit()
    conn.close()

    # Trigger complete_daily_quiz
    res6 = db.complete_daily_quiz(email, question_id=1, selected_option_index=0)
    check("New month dynamically resets remaining to 3", res6["revives_remaining"] == 3)
    check("New month has revive_available == True", res6["revive_available"] is True)

    conn = db.get_connection()
    row = conn.execute("SELECT quiz_revives_month FROM user_history WHERE email = ?", (email,)).fetchone()
    check("DB quiz_revives_month is updated to current: " + row["quiz_revives_month"], row["quiz_revives_month"] == current_month)
    conn.close()

    # Cleanup test data
    conn = db.get_connection()
    conn.execute("DELETE FROM user_history WHERE email = ?", (email,))
    conn.execute("DELETE FROM daily_events WHERE email = ?", (email,))
    conn.commit()
    conn.close()

    print("\n======================================================================")
    print("ALL REVIVE TESTS COMPLETED SUCCESSFULLY! [OK]")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()
