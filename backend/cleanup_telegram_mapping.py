import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'human_firewall.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("UPDATE user_history SET telegram_chat_id = NULL WHERE telegram_chat_id = '2019216831' AND email != 'yudi.hidayat@salessupport-dummy.local'")
conn.commit()
print("Cleaned up rows:", c.rowcount)
conn.close()
