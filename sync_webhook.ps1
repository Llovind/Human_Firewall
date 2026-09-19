$ErrorActionPreference = 'Stop'

# Compatibility wrapper. The Python implementation validates that all secrets
# and webhook paths come from environment variables and never embeds a token.
$scriptPath = Join-Path $PSScriptRoot 'sync_webhook.py'
python $scriptPath

if ($LASTEXITCODE -ne 0) {
    throw "Webhook synchronization failed with exit code $LASTEXITCODE"
}
