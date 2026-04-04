import { Elysia } from "elysia";
import { sentry } from "elysiajs-sentry";

// Fix for BigInt serialization: https://github.com/GoogleChromeLabs/jsbi/issues/30
declare global {
    interface BigInt {
        toJSON(): string;
    }
}
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import { existsSync } from "node:fs";

import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";

import { privateRoutes } from "./api/private";
import { publicRoutes } from "./api/public";
import { startBroadcastScheduler } from "./lib/broadcast-worker";
import { baseLogger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { requestContext } from "./lib/request-context";

// TLS configuration (optional — enable for local dev, skip in production behind nginx)
const enableTls = Bun.env.ENABLE_TLS === "true";
let tlsConfig: { key: ReturnType<typeof Bun.file>; cert: ReturnType<typeof Bun.file> } | undefined;

if (enableTls) {
    const keyPath = Bun.env.TLS_KEY_PATH;
    const certPath = Bun.env.TLS_CERT_PATH;

    if (!keyPath || !certPath) {
        baseLogger.error("ENABLE_TLS=true but TLS_KEY_PATH or TLS_CERT_PATH not set");
        process.exit(1);
    }

    if (!existsSync(keyPath) || !existsSync(certPath)) {
        baseLogger.error("ENABLE_TLS=true but cert files not found", { keyPath, certPath });
        process.exit(1);
    }

    tlsConfig = { key: Bun.file(keyPath), cert: Bun.file(certPath) };
}

const app = new Elysia()
    .use(cors())
    .use(requestContext)
    .use(openapi())
    .use(staticPlugin())
    .get("/api/health", () => ({ status: "ok" }))
    .onError(({ code, error, request }) => {
        const message = "message" in error ? error.message : JSON.stringify(error);
        const path = new URL(request.url).pathname;
        const method = request.method;

        if (code === "NOT_FOUND") return;

        const level = code === "VALIDATION" || code === "PARSE" ? "warn" : "error";
        baseLogger[level]("Unhandled error", { code, message, path, method });
    })
    .use(publicRoutes)
    .use(privateRoutes);

if (Bun.env.SENTRY_DSN) {
    app.use(
        sentry({
            dsn: Bun.env.SENTRY_DSN,
            environment: Bun.env.SENTRY_ENVIRONMENT ?? Bun.env.NODE_ENV ?? "development",
            tracesSampleRate: Bun.env.NODE_ENV === "production" ? 0.2 : 1.0,
        }),
    );
}

app.listen({
    port: 3000,
    hostname: "0.0.0.0",
    ...(tlsConfig ? { tls: tlsConfig } : {}),
});

const protocol = tlsConfig ? "https" : "http";
baseLogger.info(`Backend running at ${protocol}://${app.server!.hostname}:${app.server!.port}`);

prisma
    .$connect()
    .then(() => baseLogger.info("Prisma connected to database"))
    .catch((err: unknown) => baseLogger.error("Prisma connection failed", { error: err }));

// Start broadcast scheduler for scheduled sends
startBroadcastScheduler(baseLogger);
baseLogger.info("Broadcast scheduler started");

export type App = typeof app;
