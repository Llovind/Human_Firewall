import json

path_old = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
path_new = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def compare_conn():
    with open(path_old, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(path_new, "r", encoding="utf-8") as f:
        new_data = json.load(f)
        
    old_conn = old_data.get("connections", {})
    new_conn = new_data.get("connections", {})
    
    print("=== PERBEDAAN KONEKSI (OLD vs NEW) ===")
    
    # Check for connections in old but not in new
    all_keys = set(old_conn.keys()).union(set(new_conn.keys()))
    for key in sorted(all_keys):
        o_targets = old_conn.get(key, {}).get("main", [[]])[0]
        n_targets = new_conn.get(key, {}).get("main", [[]])[0]
        
        o_names = sorted([t.get("node") for t in o_targets])
        n_names = sorted([t.get("node") for t in n_targets])
        
        if o_names != n_names:
            print(f"\nNode: {key}")
            print(f"  Old targets: {o_names}")
            print(f"  New targets: {n_names}")

if __name__ == "__main__":
    compare_conn()
