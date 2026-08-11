import json
import os

def update_workflow():
    workflow_path = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
    
    if not os.path.exists(workflow_path):
        print(f"File workflow tidak ditemukan di: {workflow_path}")
        return

    with open(workflow_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Dictionary untuk memetakan nama node dan teks/caption barunya
    updates = {
        "Reply File Dangerous": {
            "key": "text",
            "value": "=⚠️ <b>File yang Anda laporkan terdeteksi BERBAHAYA.</b>\n\n📎 <b>File:</b> {{ $('Evaluate File').item.json.file_name }}\n⚠️ <b>Severity:</b> {{ $('Evaluate File').item.json.severity.toUpperCase() }}\n🛡️ <b>VT:</b> {{ $('Evaluate File').item.json.vt_verdict }}\n\nTiket insiden telah dibuat dan tim SOC kami sudah diberitahu. Terima kasih! 🙏\n\n<i>This message was sent automatically with n8n</i>"
        },
        "Reply URL Dangerous": {
            "key": "text",
            "value": "=⚠️ <b>URL yang Anda laporkan terdeteksi BERBAHAYA.</b>\n\n🔗 <b>URL:</b> {{ $('Evaluate URL').item.json.reported_url }}\n⚠️ <b>Severity:</b> {{ $('Evaluate URL').item.json.severity.toUpperCase() }}\n🛡️ <b>VT:</b> {{ $('Evaluate URL').item.json.vt_verdict }}\n\nTiket insiden telah dibuat dan tim SOC kami sudah diberitahu. Terima kasih! 🙏\n\n<i>This message was sent automatically with n8n</i>"
        },
        "SOC Alert File": {
            "key": "text",
            "value": "=🔍 <b>THREAT REPORT — FILE</b>\n\n📋 <b>ID:</b> {{ $json.ticket_id }}\n📎 <b>File:</b> {{ $('Evaluate File').item.json.file_name }}\n⚠️ <b>Severity:</b> {{ $('Evaluate File').item.json.severity.toUpperCase() }}\n🔑 <b>SHA256:</b> <code>{{ $('Evaluate File').item.json.file_hash }}</code>\n\n🛡️ <b>VT:</b> {{ $('Evaluate File').item.json.vt_verdict }}\n\n👤 <b>Pelapor:</b> {{ $('Evaluate File').item.json.reporter_name }}\n\n<i>This message was sent automatically with n8n</i>"
        },
        "SOC Alert URL": {
            "key": "caption",
            "value": "=🔍 <b>THREAT REPORT — URL</b>\n\n📋 <b>ID:</b> {{ $json.ticket_id }}\n🔗 <b>URL:</b> {{ $('Evaluate URL').item.json.reported_url }}\n⚠️ <b>Severity:</b> {{ $('Evaluate URL').item.json.severity.toUpperCase() }}\n🌐 <b>urlscan:</b> {{ $('Evaluate URL').item.json.urlscan_verdict.toUpperCase() }} (Score: {{ $('Evaluate URL').item.json.urlscan_score }}/100)\n🛡️ <b>VT:</b> {{ $('Evaluate URL').item.json.vt_verdict }}\n\n👤 <b>Pelapor:</b> {{ $('Evaluate URL').item.json.reporter_name }}\n\n<i>This message was sent automatically with n8n</i>"
        }
    }

    modified_count = 0
    for node in data.get('nodes', []):
        name = node.get('name')
        if name in updates:
            target_key = updates[name]["key"]
            target_val = updates[name]["value"]
            
            # Buat parameters jika tidak ada
            if 'parameters' not in node:
                node['parameters'] = {}
                
            node['parameters'][target_key] = target_val
            print(f"Sukses memperbarui node '{name}' parameter '{target_key}'")
            modified_count += 1

    if modified_count > 0:
        with open(workflow_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("File JSON alur kerja berhasil diperbarui!")
    else:
        print("Tidak ada node yang cocok untuk diperbarui.")

if __name__ == "__main__":
    update_workflow()
