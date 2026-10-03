# Fresh-clone lab setup

For a private hackathon demo with 5–8 users, not public production deployment.
Prerequisites: Git, Docker with Compose v2, and Python 3.10+ for the setup helper.
Node 22+ is needed only for local frontend checks. No SMTP purchase is required.

## 1. Initialize a new checkout

```sh
git clone https://github.com/Llovind/Human_Firewall.git
cd Human_Firewall
python scripts/setup_lab.py --server-host 127.0.0.1
python scripts/setup_lab.py --certificates --server-host 127.0.0.1
```

Use the server's LAN/Tailscale IPv4 address or DNS name instead of `127.0.0.1`
for a two-machine demo. The helper generates random application/database secrets
and both lab CAs. It refuses to overwrite existing ENV or PKI; it is **not a
rotation tool**. Do not run it on Daf's working installation. On Windows, `py -3`
can be used instead of `python`. Restrict access to the generated ENV and CA keys
to the server owner; `.gitignore` is not an OS access-control boundary.

For LAN testing, edit `.env`: bind `WEB_BIND_IP` and `PROXY_BIND_IP` to the server's
lab interface, configure reachable public URLs, and restrict the firewall to the
lab subnet. Keep GoPhish admin and Mailpit bound to loopback. Detailed network and
client instructions: [VM + SOC runbook](docs/DEMO_VM_SOC.md).

## 2. Connect GoPhish

```sh
docker compose up -d --build gophish mailpit
```

Open `https://localhost:3333` on the server host. Trust **the public**
`secrets/gophish-pki/afferent-lab-ca.crt` on that authorized lab machine. Initial
native GoPhish credentials are available in its startup log; inspect them locally
and change the password immediately. Copy the API key from GoPhish Settings into
`GOPHISH_API_KEY` in `.env`. Do not share logs or credentials in submission files.

The AFFERENT administrator is separate: email `BOOTSTRAP_ADMIN_EMAIL` and initial
password `ADMIN_PASSWORD` from your local `.env`. Subsequent account password
changes are stored in the database, not applied by editing this bootstrap ENV.

## 3. Start the application

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Nine services should become healthy; the tenth (`local_llm`) is optional.
Open the configured dashboard URL on port 3000. OTP and campaign email are
captured in Mailpit at `http://127.0.0.1:8025` on the host, not delivered to Gmail.
Create separate employee and SOC accounts. The helper selects `APP_ENV=development`
solely for authorized lab-material setup; debug and auth bypass remain disabled.
You may switch to `APP_ENV=production` after creating demo materials and recreate
services. HTTP cookies here are an isolated-lab compromise, not production security.

## Optional integrations

| Feature | Configuration | Without it |
| --- | --- | --- |
| Employee URL scan/link report | `VT_API_KEY`, `URLSCAN_API_KEY` | Honest Unknown/provider status |
| Private file scan, any format ≤10 MB | `VT_API_KEY`; explicit non-confidential upload consent | Unknown, no SOC report |
| Authorized campaign page cloning | `FIRECRAWL_API_KEY` | Use built-in awareness template |
| AI campaign/report assistance | Optional Gemini/Groq/OpenRouter settings | Provider-unavailable message / telemetry baseline |
| Local SOC second opinion | `LOCAL_LLM_ENABLED=true`, `--profile llm`, NVIDIA-compatible Docker GPU | Disabled; proxy ML is unaffected |

To enable local advice, start `docker compose --profile llm up -d`, pull the model
with `docker compose exec local_llm ollama pull qwen3:4b-instruct-2507-q4_K_M`, and
recreate Flask/review worker after ENV changes. Advice cannot blacklist domains.
Fine-tuned experiments have not passed promotion gates; see
[evaluation](docs/LOCAL_LLM_EVALUATION.md). They are not loaded as active models.

## Checks and safe shutdown

```sh
node scripts/check_submission.cjs
python scripts/test_setup_lab.py
cd dashboard
npm ci
npm run lint
npm test
npm run build
```

Backend and proxy checks, limitations and the manual demo checklist are listed in
[submission readiness](docs/FINAL_SUBMISSION.md). Stop with `docker compose stop`.
Preserve `.env`, `.env.proxy.local`, PKI, datasets and named volumes. Never run
`docker compose down -v` on an installation with demo history.
