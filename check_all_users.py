import sqlite3

db_path = r"C:\Human_Firewall\backend\instance\human_firewall.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== ALL USERS IN USER_HISTORY ===")
rows = c.execute("SELECT email, points, badge, reports_count_malicious, reports_count_total, daily_streak FROM user_history").fetchall()
for r in rows:
    print(dict(r))

conn.close()
