import json

path_old = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"

def compare():
    with open(path_old, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print("=== DUSTBIN / OLD WORKFLOW CHAT CONFIGS ===")
    for node in data.get("nodes", []):
        if any(k in node.get("name", "") for k in ["SOC Alert", "Reply", "Send a text"]):
            params = node.get("parameters", {})
            chat_id = params.get("chatId", "")
            text = params.get("text", "")[:100].replace("\n", " ").encode("ascii", errors="replace").decode("ascii")
            print(f"- {node['name']}:")
            print(f"  chatId: {chat_id}")
            print(f"  text: {text}...")

if __name__ == "__main__":
    compare()
