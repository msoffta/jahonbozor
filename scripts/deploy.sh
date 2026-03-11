#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Save current commit SHA for rollback
echo "$GITHUB_SHA" > .last-successful-deploy-attempt

# Log in to GitHub Container Registry
export GITHUB_TOKEN=$GITHUB_TOKEN
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

# Export configuration variables for docker-compose
export GITHUB_SHA=$GITHUB_SHA
export GITHUB_REPOSITORY=$GITHUB_REPOSITORY

# Pull latest images
echo "📦 Pulling latest Docker images..."
docker compose -f docker-compose.prod.yml pull

# Stop old containers
echo "🛑 Stopping old containers..."
docker compose -f docker-compose.prod.yml down

# Start new containers
echo "▶️  Starting new containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# Check if containers are running
echo "🔍 Checking container status..."
if ! docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "❌ Containers failed to start"
    ./rollback.sh
    exit 1
fi

# Check backend health
echo "🏥 Checking backend health..."
if ! curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "❌ Backend health check failed"
    ./rollback.sh
    exit 1
fi

# Check bot health (if health endpoint exists)
echo "🤖 Checking bot health..."
if ! curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "⚠️  Bot health check failed (endpoint may not exist)"
    # Don't fail deployment if bot health endpoint doesn't exist
fi

# Save successful deployment
if [ -f .last-successful-deploy-attempt ]; then
    mv .last-successful-deploy-attempt .last-successful-deploy
fi

echo "✅ Deployment successful!"
docker compose -f docker-compose.prod.yml ps
