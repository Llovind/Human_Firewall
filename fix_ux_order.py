import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def fix_order():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    connections = data.get("connections", {})
    
    # 1. Swap order for VT Submit URL outputs
    if "VT Submit URL" in connections:
        targets = connections["VT Submit URL"]["main"][0]
        # Find indices
        send_idx = next((i for i, t in enumerate(targets) if t.get("node") == "Send a text message"), None)
        urlscan_idx = next((i for i, t in enumerate(targets) if t.get("node") == "urlscan Submit URL"), None)
        
        if send_idx is not None and urlscan_idx is not None and send_idx > urlscan_idx:
            # Swap them so Send a text message is first
            targets[send_idx], targets[urlscan_idx] = targets[urlscan_idx], targets[send_idx]
            print("Successfully swapped VT Submit URL outputs (Send a text message is now executed first).")

    # 2. Swap order for Get TG File Path outputs
    if "Get TG File Path" in connections:
        targets = connections["Get TG File Path"]["main"][0]
        # Find indices
        send_idx = next((i for i, t in enumerate(targets) if t.get("node") == "Send a text message1"), None)
        download_idx = next((i for i, t in enumerate(targets) if t.get("node") == "Download File"), None)
        
        if send_idx is not None and download_idx is not None and send_idx > download_idx:
            # Swap them so Send a text message1 is first
            targets[send_idx], targets[download_idx] = targets[download_idx], targets[send_idx]
            print("Successfully swapped Get TG File Path outputs (Send a text message1 is now executed first).")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print("UX message order successfully optimized!")

if __name__ == "__main__":
    fix_order()
