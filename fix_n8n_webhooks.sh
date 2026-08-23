#!/bin/bash
set -e

DB="/home/node/.n8n/database.sqlite"

echo "=== Current webhook_entity entries ==="
sqlite3 "$DB" "SELECT webhookPath, workflowId, method FROM webhook_entity;"

echo ""
echo "=== Deleting stale entries (keeping only Y1DdJ2GINFVPe4ZR) ==="
sqlite3 "$DB" "DELETE FROM webhook_entity WHERE workflowId != 'Y1DdJ2GINFVPe4ZR';"

echo "=== Remaining webhook_entity entries ==="
sqlite3 "$DB" "SELECT webhookPath, workflowId, method FROM webhook_entity;"

echo "DONE"
