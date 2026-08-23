import sqlite3

DB = "/var/lib/docker/volumes/human_firewall_n8n_data/_data/database.sqlite"

db = sqlite3.connect(DB)
cur = db.cursor()

cur.execute("SELECT webhookPath, workflowId, method FROM webhook_entity")
rows = cur.fetchall()
print("BEFORE cleanup:", rows)

cur.execute("DELETE FROM webhook_entity WHERE workflowId != 'Y1DdJ2GINFVPe4ZR'")
deleted = cur.rowcount
db.commit()
print(f"Deleted {deleted} stale webhook_entity rows")

cur.execute("SELECT webhookPath, workflowId, method FROM webhook_entity")
rows = cur.fetchall()
print("AFTER cleanup:", rows)

db.close()
print("DONE")
