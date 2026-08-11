import os

def update_soc_id():
    file_path = r"C:\Human_Firewall\n8n-workflows\flow-a.json"
    if not os.path.exists(file_path):
        print(f"File tidak ditemukan di: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Ganti ID personal lama dengan ID Grup SOC baru secara global di file JSON
    old_id = "2019216831"
    new_id = "-1003979650342"
    
    if old_id in content:
        updated_content = content.replace(old_id, new_id)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print(f"Sukses memperbarui ID target dari {old_id} ke {new_id} secara global di flow-a.json!")
    else:
        print(f"ID lama {old_id} tidak ditemukan di flow-a.json (mungkin sudah pernah diupdate).")

if __name__ == "__main__":
    update_soc_id()
