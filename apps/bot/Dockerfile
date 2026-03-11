# Stage 1: Builder
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy shared packages
COPY packages ./packages

# Copy all workspace package.json files to satisfy Bun workspace resolution
COPY apps/backend/package.json ./apps/backend/
COPY apps/bot/package.json ./apps/bot/
COPY apps/frontend/admin/package.json ./apps/frontend/admin/
COPY apps/frontend/user/package.json ./apps/frontend/user/

# Install dependencies
RUN bun install --frozen-lockfile

# Now copy the actual source code (backend for Prisma schema, bot for app)
COPY apps/backend ./apps/backend
COPY apps/bot ./apps/bot

# Generate Prisma client
WORKDIR /app/apps/backend
RUN bun run prisma:generate

# Stage 2: Production
FROM oven/bun:slim

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend/src/generated ./apps/backend/src/generated
COPY --from=builder /app/apps/bot ./apps/bot

WORKDIR /app/apps/bot

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
