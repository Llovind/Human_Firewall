import os
import shutil

FLOW_A_PATH = r"C:\Human_Firewall\n8n-workflows\flow-a.json"
FLOW_B_PATH = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"

def restore():
    for file_path in [FLOW_A_PATH, FLOW_B_PATH]:
        backup_path = file_path + ".backup"
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, file_path)
            os.remove(backup_path)
            print(f"Sukses memulihkan file asli: {os.path.basename(file_path)}")
        else:
            print(f"File backup tidak ditemukan untuk: {os.path.basename(file_path)}")
    print("Semua file dengan API Key aktif Anda telah dikembalikan. Sistem berjalan normal kembali!")

if __name__ == "__main__":
    restore()
