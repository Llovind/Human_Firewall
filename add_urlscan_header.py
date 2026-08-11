import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def add_header():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for node in data.get("nodes", []):
        if node.get("name") == "urlscan Get URL Result":
            node["parameters"]["sendHeaders"] = True
            node["parameters"]["specifyHeaders"] = "keypair"
            node["parameters"]["headerParameters"] = {
                "parameters": [
                    {
                        "name": "API-Key",
                        "value": "={{ $env.URLSCAN_API_KEY }}"
                    }
                ]
            }
            print("Added API-Key header to urlscan Get URL Result.")
            
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    add_header()
