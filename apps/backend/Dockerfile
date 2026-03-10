# Stage 1: Builder
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy root package.json and workspace configs
COPY package.json bun.lock ./

# Copy all workspace packages
COPY packages ./packages

# Copy backend app
COPY apps/backend ./apps/backend

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
WORKDIR /app/apps/backend
RUN bun run prisma:generate

# Stage 2: Production
FROM oven/bun:slim

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend ./apps/backend

# Copy certs for TLS
COPY certs ./certs

WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
