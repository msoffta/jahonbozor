#!/bin/bash
set -euo pipefail

# ============================================================
# PostgreSQL Restore from Backup
# Usage: ./scripts/restore-db.sh <path-to-backup-file.sql.gz>
# ============================================================

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo "Example: $0 ./backups/jahonbozor_20260328_060000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

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

for var in DATABASE_USER DATABASE_PASSWORD DATABASE_NAME; do
    if [ -z "${!var:-}" ]; then
        echo "❌ Required variable $var is not set"
        exit 1
    fi
done

echo "⚠️  WARNING: This will DROP and RECREATE the database '$DATABASE_NAME'"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo "🔄 Starting restore..."

# Step 1: Copy and decompress backup file into the container
echo "📦 Copying backup into postgres container..."
docker cp "$BACKUP_FILE" postgres:/tmp/restore.sql.gz

echo "📦 Decompressing backup..."
docker exec postgres gunzip -f /tmp/restore.sql.gz

# Step 2: Terminate existing connections
echo "🔌 Terminating existing connections..."
docker exec postgres psql -U "$DATABASE_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DATABASE_NAME' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

# Step 3: Drop and recreate database
echo "🗑️  Dropping database '$DATABASE_NAME'..."
docker exec postgres psql -U "$DATABASE_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$DATABASE_NAME\";"

echo "🆕 Creating database '$DATABASE_NAME'..."
docker exec postgres psql -U "$DATABASE_USER" -d postgres -c \
    "CREATE DATABASE \"$DATABASE_NAME\" OWNER \"$DATABASE_USER\";"

# Step 4: Restore from SQL dump
echo "📥 Restoring from backup..."
if docker exec postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -f /tmp/restore.sql; then
    echo "✅ Database restored successfully"
else
    echo "⚠️  Restore completed with warnings (check output above)"
fi

# Step 5: Clean up temp file in container
docker exec postgres rm -f /tmp/restore.sql /tmp/restore.sql.gz
echo "🧹 Cleaned up temporary files"

# Step 6: Restart dependent services to reconnect
echo "🔄 Restarting backend and bot services..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.prod.yml restart backend bot

echo "✅ Restore complete. Services restarted."
