import json

path_old = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"

def analyze_old_messaging():
    with open(path_old, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print("=== NODE PENGIRIMAN PESAN (VERSI LAMA) ===")
    msg_nodes = ["SOC Alert URL", "Reply URL Dangerous", "Reply URL Safe", 
                 "SOC Alert File", "Reply File Dangerous", "Reply File Safe", 
                 "Reply Invalid", "Send a text message", "Send a text message1"]
                 
    for node in data.get("nodes", []):
        if node.get("name") in msg_nodes:
            print(f"\nNode: {node['name']}")
            print(f"  Type: {node['type']}")
            # Clean values for console display
            params = node.get("parameters", {})
            chat_id = params.get("chatId", "")
            text = params.get("text", "")[:100].replace("\n", " ").encode("ascii", errors="replace").decode("ascii")
            print(f"  chatId: {chat_id}")
            print(f"  text: {text}...")

    print("\n=== ALUR KONEKSI PENGIRIMAN PESAN ===")
    connections = data.get("connections", {})
    for src, targets in connections.items():
        if any(k in src for k in ["SOC Alert", "Reply", "Send a text", "IF URL", "IF File", "Create URL", "Create File"]):
            print(f"\nSource Node: {src}")
            for t_type, branch_list in targets.items():
                for idx, branch in enumerate(branch_list):
                    dest_nodes = [b.get("node") for b in branch]
                    print(f"  Branch {idx} ({t_type}) -> {dest_nodes}")

if __name__ == "__main__":
    analyze_old_messaging()
