import sqlite3, os, json

db_path = r"C:\Human_Firewall\backend\instance\human_firewall.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    print("=== TABLES IN DB ===")
    tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(tables)
    
    for t in tables:
        cols = [col[1] for col in c.execute(f"PRAGMA table_info({t})").fetchall()]
        if 'email' in cols or 'user_email' in cols or 'reporter_name' in cols or 'name' in cols:
            print(f"\n--- TABLE: {t} ---")
            query_col = 'email' if 'email' in cols else ('user_email' if 'user_email' in cols else 'name')
            rows = c.execute(f"SELECT * FROM {t} WHERE {query_col} LIKE '%yudi%' OR {query_col} LIKE '%Yudi%'").fetchall()
            for r in rows:
                print(dict(r))

conn.close()
