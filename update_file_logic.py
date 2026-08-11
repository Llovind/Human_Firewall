import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

# JavaScript code for Evaluate File
new_js_code = """const vtResult = $('VT Get File Result').item.json;
const origInput = $('Parse Input').item.json;

const vtStatus = vtResult.data?.attributes?.status || 'unknown';
const vtMalicious = vtResult.data?.attributes?.stats?.malicious || 0;
const vtTotal = Object.values(vtResult.data?.attributes?.stats || {}).reduce((a, b) => a + b, 0);
const fileHash = vtResult.meta?.file_info?.sha256 || '';

let severity = 'clean';
let isDangerous = false;
let isPending = false;
let verdict = '';

if (vtStatus !== 'completed') {
  isPending = true;
  verdict = `Analisis tertunda (Status: ${vtStatus}). Silakan kirim ulang berkas ini dalam 1 menit.`;
} else {
  if (vtMalicious >= 8) severity = 'high';
  else if (vtMalicious >= 4) severity = 'medium';
  else if (vtMalicious >= 1) severity = 'low';
  isDangerous = severity !== 'clean';
  verdict = `${vtMalicious}/${vtTotal} engines flagged malicious`;
}

return {
  json: {
    is_dangerous: isDangerous,
    is_pending: isPending,
    severity: severity,
    vt_verdict: verdict,
    file_hash: fileHash || 'unknown_hash',
    file_name: origInput.file_name,
    chat_id: origInput.chat_id,
    reporter_name: origInput.reporter_name
  }
};"""

# Dynamic text for Reply File Safe node
new_reply_text = "= {{ $json.is_pending ? '⏳' : '✅' }} {{ $json.is_pending ? 'Hasil analisis berkas Anda tertunda.' : 'File yang Anda laporkan tampak AMAN.' }}\n\n📎 {{ $json.file_name }}\n🛡️ VT: {{ $json.vt_verdict }}\n\n{{ $json.is_pending ? 'Silakan kirim ulang berkas ini beberapa saat lagi untuk verifikasi.' : 'Tidak ditemukan indikasi ancaman. Silakan buka dengan aman. 👍' }}"

def update_logic():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated_eval = False
    updated_reply = False
    
    for node in data.get("nodes", []):
        if node.get("name") == "Evaluate File":
            node["parameters"]["jsCode"] = new_js_code
            updated_eval = True
        elif node.get("name") == "Reply File Safe":
            node["parameters"]["text"] = new_reply_text
            updated_reply = True
            
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print(f"Update status -> Evaluate File: {updated_eval} | Reply File Safe: {updated_reply}")

if __name__ == "__main__":
    update_logic()
