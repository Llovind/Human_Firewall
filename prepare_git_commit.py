import os
import shutil

FLOW_A_PATH = r"C:\Human_Firewall\n8n-workflows\flow-a.json"
FLOW_B_PATH = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"

CREDS = {
    "fbfdaaa618dc7446a3e8417c08cd53d6d818e51d7d733dc2208de64e2902cb08": "<YOUR_VIRUSTOTAL_API_KEY>",
    "019f0841-2c4c-74ba-a7b7-d057f9a70cdd": "<YOUR_URLSCAN_API_KEY>",
    "8771953552:AAEV6BLdhjLp0IBXunrQ5k_4FHh9WwXuSCU": "<YOUR_TELEGRAM_BOT_TOKEN>"
}

def backup_and_sanitize():
    for file_path in [FLOW_A_PATH, FLOW_B_PATH]:
        if not os.path.exists(file_path):
            continue
        backup_path = file_path + ".backup"
        shutil.copy2(file_path, backup_path)
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        sanitized_content = content
        for secret, placeholder in CREDS.items():
            if secret in sanitized_content:
                sanitized_content = sanitized_content.replace(secret, placeholder)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(sanitized_content)
    print("Sterilisasi ulang sukses! File saat ini 100% bersih.")

if __name__ == "__main__":
    backup_and_sanitize()
