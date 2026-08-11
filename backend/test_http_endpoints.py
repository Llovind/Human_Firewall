import sys, os, json
sys.path.insert(0, r'C:\Human_Firewall\backend')

os.environ['ADMIN_PASSWORD'] = 'test-pass'
os.environ['SECRET_KEY'] = 'test-secret'
os.environ['SERVICE_API_KEY'] = 'test-service-key'

import app

client = app.app.test_client()
headers = {'Authorization': 'Bearer test-service-key', 'Content-Type': 'application/json'}

print("=== FUNCTIONAL TEST 1: GET /api/ai/classify-all ===")
# Note: refresh=false will check cache or call LLM
res1 = client.get('/api/ai/classify-all?refresh=false', headers=headers)
print(f"Status Code: {res1.status_code}")
print("Response Output Preview:", res1.get_data(as_text=True)[:500])

print("\n=== FUNCTIONAL TEST 2: POST /api/ai/agentic/investigate ===")
payload = {
    "email": "dewi.lestari@netops-dummy.local",
    "query": "Apakah user ini berisiko tinggi terhadap phishing?"
}
res2 = client.post('/api/ai/agentic/investigate', headers=headers, data=json.dumps(payload))
print(f"Status Code: {res2.status_code}")
print("Response Output Preview:", res2.get_data(as_text=True)[:800])

print("\n=== FUNCTIONAL TEST 3: GET /api/ai/router/status ===")
res3 = client.get('/api/ai/router/status', headers=headers)
print(f"Status Code: {res3.status_code}")
print("Response Output:", res3.get_data(as_text=True))
