#!/bin/bash

echo "🚀 Starting deployment..."

# Previous successful SHA for rollback
PREVIOUS_SHA=""
if [ -f .last-successful-deploy ]; then
    PREVIOUS_SHA=$(cat .last-successful-deploy)
fi

rollback() {
    echo "⚠️  Deployment failed, attempting rollback..."

    if [ -z "$PREVIOUS_SHA" ]; then
        echo "❌ No previous deployment to rollback to"
        echo "⚠️  Manual intervention required"
        exit 1
    fi

    echo "📌 Rolling back to: $PREVIOUS_SHA"
    export GITHUB_SHA=$PREVIOUS_SHA

    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker compose -f docker-compose.prod.yml pull && \
    docker compose -f docker-compose.prod.yml up -d --wait

    if [ $? -eq 0 ]; then
        echo "✅ Rollback successful — running $PREVIOUS_SHA"
        docker compose -f docker-compose.prod.yml ps
    else
        echo "❌ Rollback also failed — manual intervention required"
    fi

    exit 1
}

# Step 1: Login (old containers still running — no rollback needed on failure)
echo "🔑 Logging in to GitHub Container Registry..."
if ! echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin; then
    echo "❌ Docker login failed — old containers still running"
    exit 1
fi

# Step 2: Pull new images (old containers still running — no rollback needed)
echo "📦 Pulling new Docker images..."
export GITHUB_SHA=$GITHUB_SHA
export GITHUB_REPOSITORY=$GITHUB_REPOSITORY
if ! docker compose -f docker-compose.prod.yml pull; then
    echo "❌ Failed to pull images — old containers still running"
    exit 1
fi

# Step 3: Stop old + start new (from here, rollback on any failure)
echo "🛑 Stopping old containers..."
docker compose -f docker-compose.prod.yml down

echo "▶️  Starting new containers..."
if ! docker compose -f docker-compose.prod.yml up -d --wait; then
    echo "❌ New containers failed to start"
    rollback
fi

# Step 4: Save successful deployment
echo "$GITHUB_SHA" > .last-successful-deploy
echo "✅ Deployment successful!"
docker compose -f docker-compose.prod.yml ps
