import json

filepath = r"C:\Human_Firewall\n8n-workflows\Flow B — Threat Reporting (Fully Configured).json"
with open(filepath, "r", encoding="utf-8") as f:
    data = json.load(f)

for node in data["nodes"]:
    if node["name"] == "Download File":
        node["parameters"]["options"] = {
            "response": {
                "response": {
                    "responseFormat": "file",
                    "outputPropertyName": "data"
                }
            }
        }
        print("Updated Download File options")

    if node["name"] == "Evaluate File":
        node["parameters"]["jsCode"] = """const vtResult = $('VT Get File Result').item.json;
const origInput = $('Parse Input').item.json;

const stats = vtResult.data?.attributes?.stats || {};
const status = vtResult.data?.attributes?.status;

const vtMalicious = stats.malicious || 0;
const vtTotal = Object.values(stats).reduce((a, b) => a + b, 0);
const fileHash = vtResult.meta?.file_info?.sha256 || '';

let severity = 'clean';
if (vtMalicious >= 8) severity = 'high';
else if (vtMalicious >= 4) severity = 'medium';
else if (vtMalicious >= 1) severity = 'low';

const isDangerous = severity !== 'clean';

return {
  json: {
    is_dangerous: isDangerous,
    severity: severity,
    vt_verdict: vtTotal > 0 ? (vtMalicious + '/' + vtTotal + ' engines flagged malicious') : 'Scan Pending / 0 Engines',
    file_hash: fileHash,
    file_name: origInput.file_name,
    chat_id: origInput.chat_id,
    reporter_name: origInput.reporter_name
  }
};"""
        print("Updated Evaluate File jsCode")

with open(filepath, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done updating workflow JSON.")
