import json

path = r"C:\Human_Firewall\n8n-workflows\flow-b (2).json"

# 1. Code node for calculating hash
hash_js_code = """const crypto = require('crypto');
const binaryData = await this.helpers.getBinaryDataBuffer(0, 'data');
const hash = crypto.createHash('sha256').update(binaryData).digest('hex');
return { json: { hash: hash } };"""

# 2. Evaluate File node JS code
eval_js_code = """const vtResult = $('VT Get File Result').item.json;
const origInput = $('Parse Input').item.json;

// If the file is not found (404), vtResult won't have data
const isFound = !!vtResult.data;
const stats = vtResult.data?.attributes?.last_analysis_stats || {};
const vtMalicious = stats.malicious || 0;
const vtTotal = Object.values(stats).reduce((a, b) => a + b, 0);
const fileHash = vtResult.data?.id || '';

let severity = 'clean';
let isDangerous = false;
let verdict = '';

if (!isFound) {
  verdict = 'File baru (belum pernah dilaporkan ke VirusTotal). Hasil: Bersih.';
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
    is_pending: false, // Hash lookup is instant, never pending
    severity: severity,
    vt_verdict: verdict,
    file_hash: fileHash || 'unknown_hash',
    file_name: origInput.file_name,
    chat_id: origInput.chat_id,
    reporter_name: origInput.reporter_name
  }
};"""

def make_instant():
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for node in data.get("nodes", []):
        # A. Ubah VT Submit File menjadi Code Node (Hitung Hash)
        if node.get("name") == "VT Submit File":
            node["type"] = "n8n-nodes-base.code"
            node["typeVersion"] = 2
            node["parameters"] = {
                "jsCode": hash_js_code
            }
            print("Converted VT Submit File to Code Node (SHA256 Calculator).")
            
        # B. Ubah Wait 30s menjadi Wait 1s (Instan)
        elif node.get("name") == "Wait 30s":
            node["name"] = "Wait 1s"
            node["parameters"] = {
                "amount": 1,
                "unit": "seconds"
            }
            print("Changed Wait 30s to Wait 1s.")
            
        # C. Ubah VT Get File Result menjadi GET /files/{hash}
        elif node.get("name") == "VT Get File Result":
            node["parameters"] = {
                "url": "=https://www.virustotal.com/api/v3/files/{{ $('VT Submit File').item.json.hash }}",
                "sendHeaders": True,
                "specifyHeaders": "keypair",
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "x-apikey",
                            "value": "={{ $env.VT_API_KEY }}"
                        }
                    ]
                },
                "options": {
                    "neverFail": True  # Biar gak crash kalau file 404 (file baru)
                }
            }
            print("Updated VT Get File Result to query files/{hash} with neverFail option.")
            
        # D. Perbarui Evaluate File JS Code
        elif node.get("name") == "Evaluate File":
            node["parameters"]["jsCode"] = eval_js_code
            print("Updated Evaluate File JS logic for hash results.")

    # Update nama node di connections karena Wait 30s berubah nama jadi Wait 1s
    connections = data.get("connections", {})
    if "VT Submit File" in connections:
        for conn in connections["VT Submit File"]["main"][0]:
            if conn.get("node") == "Wait 30s":
                conn["node"] = "Wait 1s"
    if "Wait 30s" in connections:
        connections["Wait 1s"] = connections.pop("Wait 30s")
        for conn in connections["Wait 1s"]["main"][0]:
            if conn.get("node") == "VT Get File Result":
                pass # Tetap sama

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print("Workflow File Scan successfully optimized to Hash-Based Instant Scan!")

if __name__ == "__main__":
    make_instant()
