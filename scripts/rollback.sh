#!/bin/bash

echo "🔄 Starting rollback..."

if [ ! -f .last-successful-deploy ]; then
    echo "❌ No previous successful deployment found"
    echo "⚠️  Manual intervention required"
    exit 1
fi

PREVIOUS_SHA=$(cat .last-successful-deploy)
echo "📌 Rolling back to commit: $PREVIOUS_SHA"

# Stop current containers
echo "🛑 Stopping current containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Pull previous images
echo "📦 Pulling previous images..."
export GITHUB_SHA=$PREVIOUS_SHA
export GITHUB_REPOSITORY=$GITHUB_REPOSITORY
if ! docker compose -f docker-compose.prod.yml pull; then
    echo "❌ Failed to pull previous images — manual intervention required"
    exit 1
fi

# Start previous containers with health check
echo "▶️  Starting previous containers..."
if docker compose -f docker-compose.prod.yml up -d --wait; then
    echo "✅ Rollback successful"
    docker compose -f docker-compose.prod.yml ps
else
    echo "❌ Rollback failed — manual intervention required"
    exit 1
fi
