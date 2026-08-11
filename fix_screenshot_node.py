import json
import os

def fix_screenshot():
    file_path = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
    if not os.path.exists(file_path):
        print(f"File tidak ditemukan di: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Update fallback URL di node 'Verify Screenshot URL'
    verify_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'Verify Screenshot URL':
            verify_node = node
            break

    if verify_node:
        js_code = verify_node['parameters']['jsCode']
        # Ganti URL placehold.co dengan logo github/n8n yang sangat stabil
        old_placeholder = "const fallback = 'https://placehold.co/600x400/0b1120/818cf8?text=No+Screenshot+Available';"
        new_placeholder = "const fallback = 'https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png';"
        if old_placeholder in js_code:
            verify_node['parameters']['jsCode'] = js_code.replace(old_placeholder, new_placeholder)
            print("Sukses mengupdate fallback image URL di node Verify Screenshot URL.")
        else:
            # Jika formatnya sedikit berbeda
            verify_node['parameters']['jsCode'] = js_code.replace("placehold.co", "raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png")
            print("Sukses mengupdate domain fallback image di node Verify Screenshot URL.")

    # 2. Tambahkan continueOnFail pada node 'SOC Alert URL'
    soc_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'SOC Alert URL':
            soc_node = node
            break

    if soc_node:
        soc_node['continueOnFail'] = True
        soc_node['onError'] = 'continueRegularOutput'
        print("Sukses mengaktifkan 'Continue on Fail' pada node SOC Alert URL.")

    # Simpan kembali
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Flow B JSON berhasil diperbaiki!")

if __name__ == "__main__":
    fix_screenshot()
