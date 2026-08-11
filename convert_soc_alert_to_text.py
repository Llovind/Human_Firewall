import json
import os

def convert_to_text():
    file_path = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
    if not os.path.exists(file_path):
        print(f"File tidak ditemukan di: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Temukan node SOC Alert URL
    soc_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'SOC Alert URL':
            soc_node = node
            break

    if soc_node:
        # Ubah operasi dari sendPhoto ke sendMessage (default/kosongkan operation)
        params = soc_node.get('parameters', {})
        if 'operation' in params:
            del params['operation'] # Hapus sendPhoto agar default ke sendMessage
        
        # Pindahkan isi caption ke text
        if 'caption' in params:
            params['text'] = params['caption']
            del params['caption']
            
        # Hapus field file (screenshot)
        if 'file' in params:
            del params['file']
            
        print("Sukses mengubah node SOC Alert URL menjadi tipe kirim pesan teks biasa (sendMessage).")

    # Simpan kembali
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Flow B JSON berhasil disimpan!")

if __name__ == "__main__":
    convert_to_text()
