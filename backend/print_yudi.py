import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'human_firewall.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()
row = c.execute("SELECT * FROM user_history WHERE email = 'yudi.hidayat@salessupport-dummy.local'").fetchone()
if row:
    print(dict(row))
else:
    print("Not found")
conn.close()
