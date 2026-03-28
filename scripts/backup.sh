#!/bin/bash
set -euo pipefail

# ============================================================
# PostgreSQL Backup & Telegram Send
# Runs on VPS via cron: 0 */6 * * *
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$DEPLOY_DIR/.env" ]; then
    set -a
    source "$DEPLOY_DIR/.env"
    set +a
else
    echo "❌ .env file not found at $DEPLOY_DIR/.env"
    exit 1
fi

# Validate required variables
for var in DATABASE_USER DATABASE_PASSWORD DATABASE_NAME; do
    if [ -z "${!var:-}" ]; then
        echo "❌ Required variable $var is not set"
        exit 1
    fi
done

# Telegram is optional
TELEGRAM_ENABLED=false
if [ -n "${TELEGRAM_NOTIFICATION_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    TELEGRAM_ENABLED=true
fi

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$DEPLOY_DIR/backups"
BACKUP_FILE="$BACKUP_DIR/${DATABASE_NAME}_${TIMESTAMP}.sql.gz"
MAX_TELEGRAM_SIZE=$((50 * 1024 * 1024)) # 50MB in bytes

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting backup of database '$DATABASE_NAME' at $(date)"

# Step 1: Run pg_dump and compress with gzip
echo "📦 Running pg_dump + gzip..."
if ! docker exec postgres pg_dump \
    -U "$DATABASE_USER" \
    -d "$DATABASE_NAME" \
    --no-owner \
    --no-privileges \
    | gzip -9 > "$BACKUP_FILE"; then
    echo "❌ pg_dump failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Verify backup file exists and is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "❌ Backup file is empty"
    rm -f "$BACKUP_FILE"
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
BACKUP_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $BACKUP_SIZE / 1024 / 1024}")
echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE_MB MB)"

# Step 2: Send to Telegram (if configured)
if [ "$TELEGRAM_ENABLED" = true ]; then
    if [ "$BACKUP_SIZE" -ge "$MAX_TELEGRAM_SIZE" ]; then
        echo "⚠️  Backup file ($BACKUP_SIZE_MB MB) exceeds Telegram 50MB limit"
        echo "📁 Backup retained at: $BACKUP_FILE"

        curl -s -X POST \
            "https://api.telegram.org/bot${TELEGRAM_NOTIFICATION_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="⚠️ Backup too large for Telegram ($BACKUP_SIZE_MB MB). File retained on server: $BACKUP_FILE" \
            > /dev/null

        exit 1
    fi

    echo "📤 Sending backup to Telegram..."
    CAPTION="🗄️ DB Backup: ${DATABASE_NAME}
📅 $(date '+%Y-%m-%d %H:%M:%S')
📦 Size: ${BACKUP_SIZE_MB} MB (gzip -9)"

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -F chat_id="$TELEGRAM_CHAT_ID" \
        -F document=@"$BACKUP_FILE" \
        -F caption="$CAPTION" \
        "https://api.telegram.org/bot${TELEGRAM_NOTIFICATION_TOKEN}/sendDocument")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -ne 200 ]; then
        echo "❌ Telegram send failed (HTTP $HTTP_CODE)"
        echo "Response: $BODY"
        echo "📁 Backup retained at: $BACKUP_FILE"
        exit 1
    fi

    if ! echo "$BODY" | grep -q '"ok":true'; then
        echo "❌ Telegram API returned error"
        echo "Response: $BODY"
        echo "📁 Backup retained at: $BACKUP_FILE"
        exit 1
    fi

    echo "✅ Backup sent to Telegram successfully"
    rm -f "$BACKUP_FILE"
    echo "🧹 Local backup file removed"
    rmdir "$BACKUP_DIR" 2>/dev/null || true
else
    echo "ℹ️  Telegram not configured — backup retained locally"
    echo "📁 $BACKUP_FILE"
fi

echo "✅ Backup complete at $(date)"
