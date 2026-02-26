import { Elysia } from "elysia";
import { sentry } from "elysiajs-sentry";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";
import { resolve } from "node:path";

import { requestContext } from "./lib/request-context";
import { publicRoutes } from "./api/public";
import { privateRoutes } from "./api/private";
import { prisma } from "./lib/prisma";

const certDir = resolve(import.meta.dir, "../../../certs");

const app = new Elysia()
    .use(cors())
    .use(requestContext)
    .use(openapi())
    .use(staticPlugin())
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
    tls: {
        key: Bun.file(resolve(certDir, "192.168.1.108-key.pem")),
        cert: Bun.file(resolve(certDir, "192.168.1.108.pem")),
    },
});

console.log(`🚀 Backend running at https://${app.server!.hostname}:${app.server!.port}`);

prisma.$connect()
    .then(() => console.log("✅ Prisma connected to database"))
    .catch((err: unknown) => console.error("❌ Prisma connection failed:", err));

export type App = typeof app;
