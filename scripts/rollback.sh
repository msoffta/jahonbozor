#!/bin/bash
set -e

echo "🔄 Starting rollback..."

# Check if we have a previous successful deployment
if [ ! -f .last-successful-deploy ]; then
    echo "❌ No previous successful deployment found"
    echo "⚠️  Manual intervention required"
    exit 1
fi

PREVIOUS_SHA=$(cat .last-successful-deploy)
echo "📌 Rolling back to commit: $PREVIOUS_SHA"

# Stop current containers
echo "🛑 Stopping current containers..."
docker compose -f docker-compose.prod.yml down

# Pull previous images (tagged with commit SHA)
echo "📦 Pulling previous images..."
export GITHUB_SHA=$PREVIOUS_SHA
export GITHUB_REPOSITORY=$GITHUB_REPOSITORY
docker compose -f docker-compose.prod.yml pull

# Start previous containers
echo "▶️  Starting previous containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# Verify rollback
echo "🔍 Verifying rollback..."
if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Rollback successful"
    docker compose -f docker-compose.prod.yml ps
    exit 0
else
    echo "❌ Rollback failed"
    echo "⚠️  Manual intervention required"
    exit 1
fi
