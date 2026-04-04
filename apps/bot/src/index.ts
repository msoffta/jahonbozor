import { webhookCallback } from "grammy";

import { bot } from "@bot/bot";
import { logger } from "@bot/lib/logger";
import { prisma } from "@bot/lib/prisma";
import { startDebtReminderScheduler } from "@bot/lib/scheduler";

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const port = Number(process.env.BOT_PORT) || 3001;

if (!webhookUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL is not configured");
}

const handleUpdate = webhookCallback(bot, "std/http", { secretToken: webhookSecret });

export const server = Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);

        if (req.method === "POST" && url.pathname === "/bot") {
            return handleUpdate(req);
        }

        if (url.pathname === "/health") {
            try {
                await prisma.$queryRaw`SELECT 1`;
                return Response.json({ status: "ok", uptime: process.uptime() });
            } catch (error) {
                logger.error("Bot: Health check DB unreachable", { error });
                return Response.json(
                    { status: "unhealthy", uptime: process.uptime() },
                    { status: 503 },
                );
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});

// Register webhook with Telegram on startup
void bot.api
    .setWebhook(webhookUrl, { secret_token: webhookSecret, drop_pending_updates: true })
    .then(() => {
        logger.info("Bot: Webhook registered", { webhookUrl });
    })
    .catch((err: unknown) => {
        logger.error("Bot: Webhook registration failed", { error: err });
    });

// Start debt reminder scheduler (daily at 10:00 AM Asia/Samarkand)
const debtReminderJob = startDebtReminderScheduler(bot, logger);
logger.info("Bot: Debt reminder scheduler started");

// Graceful shutdown
const shutdown = async () => {
    logger.info("Bot: Shutting down...");
    debtReminderJob.stop();
    void server.stop();
    await prisma.$disconnect();
    process.exit(0);
};

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

logger.info("Bot: Server started", { port: server.port });
