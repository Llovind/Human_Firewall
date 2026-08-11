import sqlite3
import os

db_path = os.path.join("instance", "human_firewall.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Insert Sales Support employees
c.execute('''
    INSERT OR IGNORE INTO user_history (email, divisi, click_count, points, badge, is_active) 
    VALUES ('yudi.hidayat@salessupport-dummy.local', 'Sales Support', 0, 110, 'Guardian', 1)
''')
c.execute('''
    INSERT OR IGNORE INTO user_history (email, divisi, click_count, points, badge, is_active) 
    VALUES ('siti.nurhaliza@salessupport-dummy.local', 'Sales Support', 1, 85, 'Guardian', 1)
''')

# Insert IT employee
c.execute('''
    INSERT OR IGNORE INTO user_history (email, divisi, click_count, points, badge, is_active) 
    VALUES ('lovind@netengineering-dummy.local', 'IT', 0, 120, 'Sentinel', 1)
''')

conn.commit()
print("Successfully inserted missing division employees into user_history.")
conn.close()
