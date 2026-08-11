import subprocess
import os
import json

# Load the JSON file
filepath = os.path.join(os.path.dirname(__file__), '..', 'n8n-workflows', 'Flow B — Threat Reporting (Fully Configured).json')
with open(filepath, 'r') as f:
    flow_data = json.load(f)

# docker cp <local_path> hfl-n8n:/home/node/flow-b-updated.json
local_json_path = os.path.abspath(filepath)

print("Copying JSON to container...")
subprocess.run(["docker", "cp", local_json_path, "hfl-n8n:/home/node/flow-b-updated.json"], check=True)

print("Importing workflow via n8n CLI...")
res = subprocess.run(["docker", "compose", "exec", "n8n", "n8n", "import:workflow", "--id=xtA1w6pEqJpgR4Kg", "--file=/home/node/flow-b-updated.json"], capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
