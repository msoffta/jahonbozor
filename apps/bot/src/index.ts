import { webhookCallback } from "grammy";
import { bot } from "@bot/bot";
import { prisma } from "@bot/lib/prisma";
import logger from "@bot/lib/logger";

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const port = Number(process.env.BOT_PORT) || 3001;

if (!webhookUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL is not configured");
}

const handleUpdate = webhookCallback(bot, "std/http");

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
            } catch {
                return Response.json({ status: "unhealthy", uptime: process.uptime() }, { status: 503 });
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});

// Register webhook with Telegram on startup
bot.api
    .setWebhook(`${webhookUrl}`)
    .then(() => {
        logger.info(`Bot webhook registered: ${webhookUrl}`);
    })
    .catch((err) => {
        logger.error("Failed to set webhook", { error: err });
    });

// Graceful shutdown
const shutdown = async () => {
    logger.info("Bot: Shutting down...");
    server.stop();
    await prisma.$disconnect();
    process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info(`Bot server started on port ${server.port}`);
