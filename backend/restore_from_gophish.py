import requests
import urllib3
import sqlite3
import os

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Gophish credentials
api_key = "b4b0ca9969e56d5b1bd2680790b0eae1a01796b7e5f7e18762ee8e0c10975676"
gophish_url = "https://gophish:3333/api/campaigns"

# Flask Database path
db_path = os.path.join("instance", "human_firewall.db")

headers = {
    "Authorization": f"Bearer {api_key}"
}

def derive_divisi(email):
    if "@perfshared-dummy.local" in email:
        return "Performance & Shared Service"
    elif "@netops-dummy.local" in email:
        return "Network Operations"
    elif "@netengineering-dummy.local" in email:
        return "Network Engineering"
    elif "@salessupport-dummy.local" in email:
        return "Sales Support"
    else:
        return "Default"

try:
    print("Fetching campaigns from GoPhish...")
    res = requests.get(gophish_url, headers=headers, verify=False)
    if res.status_code != 200:
        print(f"Error fetching from GoPhish: HTTP {res.status_code}")
        exit(1)

    campaigns = res.json()
    print(f"Found {len(campaigns)} campaigns in GoPhish.")

    # We connect directly to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Clear existing simulation history to prevent duplicate entries
    print("Clearing Flask user_history and events tables for restoration...")
    cursor.execute("DELETE FROM user_history")
    cursor.execute("DELETE FROM events")
    conn.commit()

    users_inserted = set()
    events_recorded = 0

    for c in campaigns:
        campaign_id = str(c.get('id'))
        campaign_name = c.get('name')
        print(f"\nProcessing Campaign: {campaign_name} (ID: {campaign_id})")

        # First, ensure all targets/results exist in user_history
        results = c.get('results', [])
        for r in results:
            email = r.get('email')
            if not email:
                continue
            
            divisi = derive_divisi(email)
            if email not in users_inserted:
                # Insert employee with default 100 points
                cursor.execute('''
                    INSERT OR IGNORE INTO user_history (email, divisi, click_count, points, badge)
                    VALUES (?, ?, 0, 100, 'Guardian')
                ''', (email, divisi))
                users_inserted.add(email)
                print(f"  Restored Employee: {email} ({divisi})")

        # Second, replay all timeline events in order of timestamp
        timeline = c.get('timeline', [])
        # Sort timeline by time so points are adjusted chronologically
        timeline_sorted = sorted(timeline, key=lambda x: x.get('time', ''))

        for event in timeline_sorted:
            email = event.get('email')
            message = event.get('message')
            event_time = event.get('time')

            if not email:
                continue

            divisi = derive_divisi(email)

            # Map Gophish event types to Flask event types
            event_type = None
            if message == "Clicked Link":
                event_type = "clicked_link"
            elif message == "Submitted Data":
                event_type = "submitted_data"
            elif message == "Email Opened":
                event_type = "email_opened"

            if event_type:
                # 1. Insert into events log
                cursor.execute('''
                    INSERT INTO events (email, divisi, event_type, campaign_id, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (email, divisi, event_type, campaign_id, event_time))

                # 2. Update user history aggregates & points
                if event_type == "clicked_link":
                    cursor.execute('''
                        UPDATE user_history
                        SET click_count = click_count + 1,
                            last_clicked = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE email = ?
                    ''', (event_time, email))

                    # Deduct 10 points
                    row = cursor.execute('SELECT points FROM user_history WHERE email = ?', (email,)).fetchone()
                    points = row[0] if row else 100
                    new_points = max(0, min(200, points - 10))
                    
                    # Update points & badge
                    badge = "Vulnerable" if new_points < 60 else ("Sentinel" if new_points >= 130 else "Guardian")
                    cursor.execute('UPDATE user_history SET points = ?, badge = ? WHERE email = ?', (new_points, badge, email))

                elif event_type == "submitted_data":
                    # Deduct 20 points
                    row = cursor.execute('SELECT points FROM user_history WHERE email = ?', (email,)).fetchone()
                    points = row[0] if row else 100
                    new_points = max(0, min(200, points - 20))
                    
                    badge = "Vulnerable" if new_points < 60 else ("Sentinel" if new_points >= 130 else "Guardian")
                    cursor.execute('UPDATE user_history SET points = ?, badge = ? WHERE email = ?', (new_points, badge, email))

                events_recorded += 1

    conn.commit()
    conn.close()

    print(f"\nSUCCESS! Restored {len(users_inserted)} employees and replayed {events_recorded} campaign events from GoPhish.")

except Exception as e:
    print("Error restoring database:", e)
