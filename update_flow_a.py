import json
import os

def update_flow_a():
    file_path = r"C:\Human_Firewall\n8n-workflows\flow-a.json"
    if not os.path.exists(file_path):
        print(f"File tidak ditemukan di: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Temukan node Switch dan tambahkan rule ke-3 (clicked_link)
    switch_node = None
    for node in data.get('nodes', []):
        if node.get('name') == 'Switch':
            switch_node = node
            break

    if not switch_node:
        print("Gagal menemukan node Switch di flow-a.json")
        return

    # Tambahkan rule ke-3 jika belum ada
    rules = switch_node['parameters']['rules']['values']
    if len(rules) < 3:
        new_rule = {
            "conditions": {
                "options": {
                    "caseSensitive": True,
                    "leftValue": "",
                    "typeValidation": "loose",
                    "version": 3
                },
                "conditions": [
                    {
                        "id": "clicked-link-cond-id",
                        "leftValue": "={{ $json.body.event_type }}",
                        "rightValue": "clicked_link",
                        "operator": {
                            "type": "string",
                            "operation": "equals"
                        }
                    }
                ],
                "combinator": "and"
            },
            "renameOutput": True,
            "outputKey": "User Click"
        }
        rules.append(new_rule)
        print("Sukses menambahkan rule 'User Click' ke node Switch.")

    # 2. Tambahkan node Telegram baru (User Click Alert)
    user_click_node = {
        "parameters": {
            "chatId": "={{ $json.body.telegram_chat_id }}",
            "text": "=⚠️ <b>Anda baru saja mengklik tautan simulasi phishing.</b>\n\nJangan khawatir, ini adalah bagian dari latihan keamanan berkala untuk karyawan <b>Infranexia</b>.\n\nTetap tenang dan silakan baca panduan di halaman edukasi yang terbuka di browser Anda untuk mengenali ciri-ciri email serupa di masa depan! 🛡️\n\n<i>This message was sent automatically with n8n</i>",
            "additionalFields": {
                "appendAttribution": False
            }
        },
        "type": "n8n-nodes-base.telegram",
        "typeVersion": 1.2,
        "position": [
            544,
            -888
        ],
        "id": "user-click-alert-telegram-node-id",
        "name": "User Click Alert",
        "webhookId": "user-click-alert-webhook-id",
        "credentials": {
            "telegramApi": {
                "id": "I44oUHC8lBGyDI79",
                "name": "Telegram account 2"
            }
        },
        "onError": "continueRegularOutput" # Ini setara dengan Continue on Fail di n8n
    }

    # Cek apakah node sudah ada sebelum dimasukkan
    node_names = [n.get('name') for n in data.get('nodes', [])]
    if 'User Click Alert' not in node_names:
        data['nodes'].append(user_click_node)
        print("Sukses menambahkan node 'User Click Alert' ke daftar nodes.")

    # 3. Hubungkan output ke-3 Switch ke node User Click Alert
    connections = data.get('connections', {})
    if 'Switch' in connections:
        main_conn = connections['Switch']['main']
        # Pastikan list memiliki 3 sub-list (sesuai jumlah output)
        while len(main_conn) < 3:
            main_conn.append([])
            
        # Isi output ke-3 dengan target node baru
        if not main_conn[2]:
            main_conn[2] = [
                {
                    "node": "User Click Alert",
                    "type": "main",
                    "index": 0
                }
            ]
            print("Sukses menghubungkan Switch (output ke-3) ke User Click Alert.")

    # Simpan kembali file JSON
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("file JSON alur kerja flow-a.json berhasil diupdate!")

if __name__ == "__main__":
    update_flow_a()
