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

# Start new containers and wait for them to be healthy
echo "▶️  Starting new containers and waiting for health checks..."
if ! docker compose -f docker-compose.prod.yml up -d --wait; then
    echo "❌ Deployment failed (health check or startup error)"
    ./rollback.sh
    exit 1
fi

# Save successful deployment
if [ -f .last-successful-deploy-attempt ]; then
    mv .last-successful-deploy-attempt .last-successful-deploy
fi

echo "✅ Deployment successful!"
docker compose -f docker-compose.prod.yml ps
