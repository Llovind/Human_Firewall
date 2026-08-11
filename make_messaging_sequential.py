import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def make_sequential():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # 1. Update Download File URL parameter to read from Get TG File Path specifically
    for node in data.get("nodes", []):
        if node.get("name") == "Download File":
            node["parameters"]["url"] = "=https://api.telegram.org/file/bot8771953552:AAEV6BLdhjLp0IBXunrQ5k_4FHh9WwXuSCU/{{ $('Get TG File Path').item.json.result.file_path }}"
            print("Updated Download File URL to reference Get TG File Path directly.")
            
    connections = data.get("connections", {})
    
    # 2. Sequential URL Branch: VT Submit URL -> Send a text message -> urlscan Submit URL
    if "VT Submit URL" in connections:
        connections["VT Submit URL"]["main"] = [[{
            "node": "Send a text message",
            "type": "main",
            "index": 0
        }]]
        print("Connected VT Submit URL -> Send a text message.")
        
    connections["Send a text message"] = {"main": [[{
        "node": "urlscan Submit URL",
        "type": "main",
        "index": 0
    }]]}
    print("Connected Send a text message -> urlscan Submit URL.")

    # 3. Sequential File Branch: Get TG File Path -> Send a text message1 -> Download File
    if "Get TG File Path" in connections:
        connections["Get TG File Path"]["main"] = [[{
            "node": "Send a text message1",
            "type": "main",
            "index": 0
        }]]
        print("Connected Get TG File Path -> Send a text message1.")
        
    connections["Send a text message1"] = {"main": [[{
        "node": "Download File",
        "type": "main",
        "index": 0
    }]]}
    print("Connected Send a text message1 -> Download File.")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print("UX Connection order successfully refactored to Sequential Line!")

if __name__ == "__main__":
    make_sequential()
