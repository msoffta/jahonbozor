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

# Health check via nginx container (ports are not published to host)
echo "🏥 Checking backend health via nginx..."
NGINX_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' jahonbozor-nginx)
for i in $(seq 1 5); do
    if curl -f -s "http://$NGINX_IP/api/health" > /dev/null 2>&1; then
        echo "✅ Backend health check passed"
        break
    fi
    if [ "$i" -eq 5 ]; then
        echo "❌ Backend health check failed after 5 attempts"
        ./rollback.sh
        exit 1
    fi
    echo "⏳ Attempt $i/5 failed, retrying in 5s..."
    sleep 5
done

# Save successful deployment
if [ -f .last-successful-deploy-attempt ]; then
    mv .last-successful-deploy-attempt .last-successful-deploy
fi

echo "✅ Deployment successful!"
docker compose -f docker-compose.prod.yml ps
