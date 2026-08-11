import json

path_old = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
path_new = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def restore_ux():
    # Load old and new workflows
    with open(path_old, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(path_new, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    # 1. Extract the Send a text nodes from old workflow
    ux_nodes = []
    for node in old_data.get("nodes", []):
        if node.get("name") in ["Send a text message", "Send a text message1"]:
            # Ensure they use env variables as credentials if needed,
            # but they just use telegramApi which refers to the credential ID, so it is clean.
            ux_nodes.append(node)

    # Add them to new workflow nodes if they aren't there
    existing_names = [n.get("name") for n in new_data.get("nodes", [])]
    for n in ux_nodes:
        if n.get("name") not in existing_names:
            new_data["nodes"].append(n)
            print(f"Restored node: {n.get('name')}")

    # 2. Update connections in new workflow
    connections = new_data.get("connections", {})

    # Connect VT Submit URL -> Send a text message
    if "VT Submit URL" in connections:
        targets = connections["VT Submit URL"]["main"][0]
        # Check if already connected
        if not any(t.get("node") == "Send a text message" for t in targets):
            targets.append({
                "node": "Send a text message",
                "type": "main",
                "index": 0
            })
            print("Connected VT Submit URL to Send a text message.")

    # Connect Get TG File Path -> Send a text message1
    if "Get TG File Path" in connections:
        targets = connections["Get TG File Path"]["main"][0]
        # Check if already connected
        if not any(t.get("node") == "Send a text message1" for t in targets):
            targets.append({
                "node": "Send a text message1",
                "type": "main",
                "index": 0
            })
            print("Connected Get TG File Path to Send a text message1.")

    # Add empty outgoing connections for the restored nodes to avoid n8n validation warnings
    connections["Send a text message"] = {"main": [[]]}
    connections["Send a text message1"] = {"main": [[]]}

    # Write back the updated workflow
    with open(path_new, "w", encoding="utf-8") as f:
        json.dump(new_data, f, indent=2)
    print("UX Parallel messaging successfully restored in flow-b (2).json!")

if __name__ == "__main__":
    restore_ux()
