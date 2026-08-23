# Automated Telegram & Cloudflare Webhook Sync Script for Afferent / Human Firewall
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Afferent Human Firewall - Webhook & Tunnel Sync Tool" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Stop existing cloudflared
Write-Host "[1/5] Stopping stale cloudflared tunnel..." -ForegroundColor Yellow
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Remove old logs to guarantee we only extract the brand-new tunnel URL
Remove-Item -Path "C:\Human_Firewall\cloudflared.log", "C:\Human_Firewall\cloudflared_out.log" -Force -ErrorAction SilentlyContinue

# 2. Launch cloudflared tunnel in background
Write-Host "[2/5] Starting fresh Cloudflare tunnel (localhost:5678)..." -ForegroundColor Yellow
Start-Process -FilePath "C:\Program Files (x86)\cloudflared\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:5678" -RedirectStandardError "C:\Human_Firewall\cloudflared.log" -RedirectStandardOutput "C:\Human_Firewall\cloudflared_out.log" -WindowStyle Hidden

# 3. Wait and read active trycloudflare URL
Write-Host "[3/5] Extracting active public tunnel URL..." -ForegroundColor Yellow
$activeUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path "C:\Human_Firewall\cloudflared.log") {
        $content = Get-Content -Path "C:\Human_Firewall\cloudflared.log" -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
            $matches = [regex]::Matches($content, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
            $activeUrl = $matches[$matches.Count - 1].Value
            break
        }
    }
}

if (-not $activeUrl) {
    Write-Host "[ERROR] Gagal mendapatkan URL Cloudflare tunnel baru." -ForegroundColor Red
    exit 1
}

Write-Host "  -> Active Tunnel URL: $activeUrl" -ForegroundColor Green

# Wait for Cloudflare Anycast DNS propagation
Write-Host "  -> Waiting for Cloudflare Anycast DNS propagation..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 4. Update .env and restart n8n container
Write-Host "[4/5] Updating .env and recreating n8n container..." -ForegroundColor Yellow
(Get-Content -Path "C:\Human_Firewall\.env") -replace 'WEBHOOK_URL=https://.*', "WEBHOOK_URL=$activeUrl" | Set-Content -Path "C:\Human_Firewall\.env"
docker compose up -d n8n flask_api

# 5. Set Telegram Webhook with retry logic
Write-Host "[5/5] Registering active webhook with Telegram Bot API..." -ForegroundColor Yellow
$token = "8771953552:AAEV6BLdhjLp0IBXunrQ5k_4FHh9WwXuSCU"
$webhookEndpoint = "$activeUrl/webhook/d7e352ba-9e3b-45f1-92cd-dee3d8bc1565/webhook"

$success = $false
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        $tgRes = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook?url=$webhookEndpoint&drop_pending_updates=True" -Method Get -TimeoutSec 10
        if ($tgRes.ok) {
            $success = $true
            break
        }
    } catch {
        Write-Host "     DNS resolving on Telegram servers... retrying ($attempt/5)..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

if ($success) {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  SUCCESS: Telegram Webhook & Tunnel Synchronized!" -ForegroundColor Green
    Write-Host "  Active Endpoint: $webhookEndpoint" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Gagal mendaftarkan webhook ke Telegram. Coba jalankan kembali script ini." -ForegroundColor Yellow
}
