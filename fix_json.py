import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def fix_workflow():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for node in data.get("nodes", []):
        if node.get("name") == "VT Get URL Result":
            node["parameters"]["url"] = "https://www.virustotal.com/api/v3/analyses/{{ $('VT Submit URL').item.json.data.id }}"
            print("Fixed VT Get URL Result URL.")
            
        elif node.get("name") == "VT Get File Result":
            node["parameters"]["url"] = "https://www.virustotal.com/api/v3/analyses/{{ $('VT Submit File').item.json.data.id }}"
            print("Fixed VT Get File Result URL.")
            
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    fix_workflow()
