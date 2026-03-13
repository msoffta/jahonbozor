import { Elysia } from "elysia";
import { sentry } from "elysiajs-sentry";

// Fix for BigInt serialization: https://github.com/GoogleChromeLabs/jsbi/issues/30
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

import { requestContext } from "./lib/request-context";
import { publicRoutes } from "./api/public";
import { privateRoutes } from "./api/private";
import { prisma } from "./lib/prisma";
import baseLogger from "./lib/logger";

// TLS configuration (optional — enable for local dev, skip in production behind nginx)
const enableTls = Bun.env.ENABLE_TLS === "true";
let tlsConfig: { key: ReturnType<typeof Bun.file>; cert: ReturnType<typeof Bun.file> } | undefined;

if (enableTls) {
    const certDir = resolve(import.meta.dir, "../../../certs");
    const keyPath = Bun.env.TLS_KEY_PATH || resolve(certDir, "192.168.1.108-key.pem");
    const certPath = Bun.env.TLS_CERT_PATH || resolve(certDir, "192.168.1.108.pem");

    if (!existsSync(keyPath) || !existsSync(certPath)) {
        console.error(`❌ ENABLE_TLS=true but cert files not found:\n  key: ${keyPath}\n  cert: ${certPath}`);
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
        const message = "message" in error ? error.message : String(error);
        const path = new URL(request.url).pathname;
        const method = request.method;

        if (code === "NOT_FOUND") return;

        const level = code === "VALIDATION" || code === "PARSE" ? "warn" : "error";
        baseLogger[level]("Unhandled error", { code, message, path, method });
    })
    .use(publicRoutes)
    .use(privateRoutes);

if (Bun.env.SENTRY_DSN) {
    app.use(sentry({
        dsn: Bun.env.SENTRY_DSN,
        environment: Bun.env.SENTRY_ENVIRONMENT || Bun.env.NODE_ENV || "development",
        tracesSampleRate: Bun.env.NODE_ENV === "production" ? 0.2 : 1.0,
    }));
}

app.listen({
    port: 3000,
    hostname: "0.0.0.0",
    ...(tlsConfig ? { tls: tlsConfig } : {}),
});

const protocol = tlsConfig ? "https" : "http";
console.log(`🚀 Backend running at ${protocol}://${app.server!.hostname}:${app.server!.port}`);

prisma.$connect()
    .then(() => console.log("✅ Prisma connected to database"))
    .catch((err: unknown) => console.error("❌ Prisma connection failed:", err));

export type App = typeof app;
