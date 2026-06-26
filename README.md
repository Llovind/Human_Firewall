# Human_Firewall Lite

A **security awareness training platform** that simulates internal phishing attacks to vaccinate employees against social engineering threats.

## What It Does

Human_Firewall Lite is not a passive monitoring or defense tool — it's an **active security awareness simulator** that:

- 🎯 **Sends fake phishing emails** to employees to test their security awareness
- 📊 **Measures vulnerability** — tracks who falls for the bait and who doesn't
- 🧠 **Delivers instant education** — automatically educates users who click malicious links
- ⚠️ **Escalates chronic clickers** — notifies security teams about repeated victims
- 🛡️ **Crowdsources threat detection** — employees can report suspicious emails via Telegram, which are automatically verified using VirusTotal/urlscan.io

## Architecture

The platform consists of three containerized components:

| Component | Role |
|-----------|------|
| **GoPhish** | Open-source phishing framework — sends simulated phishing emails with unique tracking links |
| **Flask Backend** | Serves real-time education pages, logs all events, calculates Human Risk Score, generates incidents |
| **n8n** | Orchestration engine — handles notifications, escalations, and Telegram integration |
| **SQLite** | Single source of truth for all event data (employee clicks, training views, submissions) |

## Quick Start

### Prerequisites
- Docker Desktop (Windows) with WSL2 backend
- Or Docker Engine (Linux/Mac)

### Setup & Run

```bash
# Clone the repository
git clone https://github.com/Llovind/Human_Firewall.git
cd Human_Firewall

# Start all services
docker compose up -d

# Check container status
docker compose ps
```

Services will be available at:
- **GoPhish Admin**: http://localhost:3333
- **Flask API**: http://localhost:5000
- **n8n**: http://localhost:5678

## How It Works

### 1. Phishing Simulation
- Administrator creates a phishing campaign in GoPhish with target employees
- GoPhish generates unique tracking links for each recipient
- Employees receive simulated phishing emails

### 2. User Interaction
- If user **clicks the link**: redirected to Flask backend
- Flask serves a fake login page or educational content (based on campaign type)
- User's interaction is logged to SQLite database

### 3. Automatic Response
- Flask calculates **Human Risk Score** per division
- If user submitted credentials: instant educational redirect + notification to n8n
- If user is a "chronic clicker" (repeated victims): escalation ticket generated

### 4. Human-Initiated Detection (In Progress)
- Employees can report suspicious emails via Telegram bot
- System automatically verifies URLs using VirusTotal/urlscan.io
- Verified threats trigger security team notifications

## Project Structure

```
Human_Firewall/
├── backend/               # Flask application
│   ├── app.py            # Main Flask app (event logging, risk scoring)
│   ├── database.py       # SQLite database schema & queries
│   ├── requirements.txt  # Python dependencies
│   ├── Dockerfile        # Flask container configuration
│   └── templates/        # HTML templates (fake login, education pages)
├── gophish/              # GoPhish configuration
│   ├── config.json       # GoPhish settings (admin API, email server)
│   └── Dockerfile        # GoPhish container configuration
├── docker-compose.yml    # Orchestration for all services
├── .env.example          # Environment variables template
└── README.md             # This file
```

## Environment Configuration

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Key environment variables:
- `FLASK_SECRET_KEY` — Flask session secret
- `GOPHISH_API_KEY` — GoPhish admin API authentication
- `N8N_WEBHOOK_URL` — n8n webhook for event notifications
- `TELEGRAM_BOT_TOKEN` — Telegram bot token (for threat reporting)
- `VIRUSTOTAL_API_KEY` — VirusTotal API key (for URL verification)

## API Endpoints

### Flask Backend

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/redirect-handler?rid=<tracking_id>` | Capture click event, serve education content |
| `POST` | `/api/submit-credentials` | Log credential submission, trigger education |
| `GET` | `/api/risk-score/<division>` | Get Human Risk Score for a division |
| `GET` | `/api/incidents` | List all generated security incidents |

## Configuration

### GoPhish Setup
- Admin panel: `http://localhost:3333`
- Default credentials: See `gophish/config.json`
- Configure SMTP server for email delivery

### Flask Configuration
- Edit `backend/app.py` to customize education content
- Modify `backend/templates/` for landing page design

### n8n Workflows
- Access at `http://localhost:5678`
- Configure Telegram notifications
- Set up escalation rules for chronic clickers

## Important Limitations

⚠️ **This is NOT an automated threat detection system.** Human_Firewall requires human action to work:
- It only logs events when users **click** phishing links (requires GoPhish sending)
- It only verifies threats when users **report** via Telegram (no passive scanning)
- It does NOT catch real attacks without manual trigger

This is a **deliberate design choice**, not a limitation to hide. The tool focuses on education and awareness, not replacing network security infrastructure.

## Development

### Running in Development Mode

```bash
# Without Docker (requires Python 3.8+)
cd backend
pip install -r requirements.txt
python app.py
```

### Running Tests
```bash
docker compose -f docker-compose.test.yml up
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Containers fail to start | Check Docker daemon is running, verify ports 3333, 5000, 5678 are free |
| Flask can't connect to SQLite | Ensure `/backend/data/` directory exists with proper permissions |
| Emails not sending | Verify SMTP credentials in GoPhish config, check `docker compose logs gophish` |
| n8n webhooks not firing | Verify Flask can reach n8n container, check n8n logs: `docker compose logs n8n` |
