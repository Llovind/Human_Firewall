import sqlite3, json

DB = "/var/lib/docker/volumes/human_firewall_n8n_data/_data/database.sqlite"
db = sqlite3.connect(DB)
cur = db.cursor()

# List credentials
cur.execute("SELECT id, name, type FROM credentials_entity")
creds = cur.fetchall()
print("=== Stored Credentials ===")
for c in creds:
    print(f"  id={c[0]} name={c[1]} type={c[2]}")

# List workflows and their credential references
cur.execute("SELECT id, name, active FROM workflow_entity")
wfs = cur.fetchall()
print("\n=== Workflows ===")
for w in wfs:
    print(f"  id={w[0]} name={w[1]} active={w[2]}")

db.close()
