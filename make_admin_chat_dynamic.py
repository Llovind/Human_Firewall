import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def make_admin_chat_dynamic():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated = 0
    for node in data.get("nodes", []):
        if node.get("name") in ["SOC Alert URL", "SOC Alert File"]:
            node["parameters"]["chatId"] = "={{ $env.SOC_CHAT_ID }}"
            updated += 1
            
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print(f"Sukses mengubah {updated} node SOC Alert menjadi dinamis menggunakan $env.SOC_CHAT_ID!")

if __name__ == "__main__":
    make_admin_chat_dynamic()
