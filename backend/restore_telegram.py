import sqlite3
import os

db_path = os.path.join("instance", "human_firewall.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("UPDATE user_history SET telegram_chat_id='2019216831' WHERE email='rina.kusuma@netengineering-dummy.local'")
conn.commit()
print("Updated Rina's Telegram Chat ID to 2019216831")
conn.close()
