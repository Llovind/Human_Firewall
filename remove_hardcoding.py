import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

def clean_hardcoding():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    cleaned_vt = 0
    cleaned_us = 0
    
    for node in data.get("nodes", []):
        # Periksa parameter header di setiap node
        parameters = node.get("parameters", {})
        header_params = parameters.get("headerParameters", {}).get("parameters", [])
        
        for param in header_params:
            # Ganti header x-apikey dengan env var
            if param.get("name") == "x-apikey":
                param["value"] = "={{ $env.VT_API_KEY }}"
                cleaned_vt += 1
            # Ganti header API-Key dengan env var
            elif param.get("name") == "API-Key":
                param["value"] = "={{ $env.URLSCAN_API_KEY }}"
                cleaned_us += 1
                
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print(f"Sukses mengonversi {cleaned_vt} node VT dan {cleaned_us} node urlscan menjadi dinamis ($env)!")

if __name__ == "__main__":
    clean_hardcoding()
