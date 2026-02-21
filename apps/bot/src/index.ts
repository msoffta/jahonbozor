import { webhookCallback } from "grammy";
import { bot } from "@bot/bot";
import logger from "@bot/lib/logger";

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const port = Number(process.env.BOT_PORT) || 3001;

if (!webhookUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL is not configured");
}

const handleUpdate = webhookCallback(bot, "std/http");

const server = Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);

        if (req.method === "POST" && url.pathname === "/bot") {
            return handleUpdate(req);
        }

        return new Response("OK", { status: 200 });
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

logger.info(`Bot server started on port ${port}`);
