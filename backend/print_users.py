import sqlite3
import os

db_path = os.path.join("instance", "human_firewall.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT email, divisi, click_count, points, badge, telegram_chat_id FROM user_history")
for r in c.fetchall():
    print(r)
conn.close()
