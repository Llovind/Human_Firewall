import os
import sys

# Read and parse .env manually to avoid dependency issues
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, "..", ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

# Change directory to backend to ensure database and template paths resolve correctly
os.chdir(backend_dir)

# Add backend directory to sys.path
sys.path.insert(0, backend_dir)

# Run Flask app
print("Starting local Flask backend server...")
from app import app
app.run(host='0.0.0.0', port=5000, debug=False)
