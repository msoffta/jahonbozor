import { Cron } from "croner";

import { sendMessage } from "./mtproto";
import { prisma } from "./prisma";

import type { Logger } from "@jahonbozor/logger";

/**
 * Sanitize TipTap HTML to Telegram-compatible HTML.
 * Telegram supports: <b>, <i>, <u>, <s>, <a>, <code>, <pre>, <blockquote>
 * TipTap adds: <p>, <br>, <em>, <strong>, <del>, etc.
 */
function sanitizeTelegramHtml(html: string): string {
    return (
        html
            // <strong> → <b>, <em> → <i>, <del> → <s>
            .replace(/<strong>/g, "<b>")
            .replace(/<\/strong>/g, "</b>")
            .replace(/<em>/g, "<i>")
            .replace(/<\/em>/g, "</i>")
            .replace(/<del>/g, "<s>")
            .replace(/<\/del>/g, "</s>")
            // <p>...</p> → ...\n (remove p tags, add newlines)
            .replace(/<p>/g, "")
            .replace(/<\/p>/g, "\n")
            // <br> → \n
            .replace(/<br\s*\/?>/g, "\n")
            // Strip any remaining unsupported tags but keep content
            .replace(/<(?!\/?(?:b|i|u|s|a|code|pre|blockquote)\b)[^>]*>/g, "")
            // Trim trailing newlines
            .replace(/\n+$/, "")
    );
}

/** Convert raw technical error to user-friendly message */
function humanizeError(raw: string): string {
    if (raw.includes("not found") || raw.includes("не найден"))
        return "Пользователь не найден в Telegram";
    if (raw.includes("PEER_ID_INVALID")) return "Невалидный Telegram ID";
    if (raw.includes("USER_IS_BLOCKED")) return "Пользователь заблокировал бота";
    if (raw.includes("bot was blocked")) return "Пользователь заблокировал бота";
    if (raw.includes("chat not found")) return "Чат не найден";
    if (raw.includes("Forbidden")) return "Нет доступа к пользователю";
    if (raw.includes("Too Many Requests")) return "Превышен лимит запросов";
    if (raw.includes("input entity")) return "Пользователь не найден в Telegram";
    return "Ошибка отправки";
}

interface ActiveBroadcast {
    paused: boolean;
    abortController: AbortController;
}

// Active broadcast tracking
const activeBroadcasts = new Map<number, ActiveBroadcast>();

const SEND_DELAY_MS = 35; // ~28 msgs/sec, under Telegram's 30/sec limit
const SCHEDULER_INTERVAL = "*/30 * * * * *"; // every 30 seconds

/**
 * Start the broadcast scheduler that picks up SCHEDULED broadcasts.
 */
export function startBroadcastScheduler(logger: Logger): Cron {
    return new Cron(SCHEDULER_INTERVAL, { timezone: "Asia/Samarkand", protect: true }, async () => {
        try {
            const now = new Date();
            const scheduledBroadcasts = await prisma.broadcast.findMany({
                where: {
                    status: "SCHEDULED",
                    scheduledAt: { lte: now },
                    deletedAt: null,
                },
            });

            for (const broadcast of scheduledBroadcasts) {
                logger.info("BroadcastWorker: Starting scheduled broadcast", {
                    broadcastId: broadcast.id,
                    name: broadcast.name,
                });
                void executeBroadcast(broadcast.id, logger);
            }
        } catch (error) {
            logger.error("BroadcastWorker: Scheduler error", { error });
        }
    });
}

/**
 * Execute a broadcast — send messages to all pending recipients.
 */
/**
 * Send a message via Telegram Bot API using direct fetch.
 */
async function sendViaBotApi(
    telegramId: string,
    content: string,
    buttons: { text: string; url: string }[] | null | undefined,
): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const body: Record<string, unknown> = {
        chat_id: telegramId,
        text: content,
        parse_mode: "HTML",
    };

    if (buttons && buttons.length > 0) {
        body.reply_markup = {
            inline_keyboard: [buttons.map((btn) => ({ text: btn.text, url: btn.url }))],
        };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Bot API error ${response.status}: ${errorBody}`);
    }
}

export async function executeBroadcast(broadcastId: number, logger: Logger): Promise<void> {
    const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        include: {
            template: true,
            session: { select: { id: true, status: true } },
        },
    });

    if (!broadcast || broadcast.deletedAt) {
        logger.warn("BroadcastWorker: Broadcast not found or deleted", { broadcastId });
        return;
    }

    const isBotMode = broadcast.sendVia === "BOT";

    // SESSION mode requires an active session
    if (!isBotMode) {
        if (broadcast.session?.status !== "ACTIVE") {
            await prisma.broadcast.update({
                where: { id: broadcastId },
                data: { status: "FAILED" },
            });
            logger.error("BroadcastWorker: Session is not active", {
                broadcastId,
                sessionId: broadcast.sessionId,
                sessionStatus: broadcast.session?.status,
            });
            return;
        }
    }

    // Set broadcast to SENDING
    await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: "SENDING", startedAt: new Date() },
    });

    const abortController = new AbortController();
    activeBroadcasts.set(broadcastId, { paused: false, abortController });

    // Resolve content from template or direct content, sanitize for Telegram
    const rawContent = broadcast.content ?? broadcast.template?.content ?? "";
    const messageContent = sanitizeTelegramHtml(rawContent);
    const messageMedia = (broadcast.media ?? broadcast.template?.media) as
        | { type: string; url: string }[]
        | null;
    const messageButtons = (broadcast.buttons ?? broadcast.template?.buttons) as
        | { text: string; url: string }[]
        | null;

    let sentCount = 0;
    let failedCount = 0;

    try {
        // Process recipients in batches
        const BATCH_SIZE = 100;
        const offset = 0;
        let hasMore = true;

        while (hasMore) {
            const state = activeBroadcasts.get(broadcastId);
            if (!state || state.abortController.signal.aborted) {
                logger.info("BroadcastWorker: Broadcast aborted", { broadcastId });
                break;
            }

            if (state.paused) {
                await prisma.broadcast.update({
                    where: { id: broadcastId },
                    data: { status: "PAUSED" },
                });
                logger.info("BroadcastWorker: Broadcast paused", { broadcastId, sentCount });
                return;
            }

            const recipients = await prisma.broadcastRecipient.findMany({
                where: { broadcastId, status: "PENDING" },
                take: BATCH_SIZE,
                skip: offset,
                orderBy: { id: "asc" },
            });

            if (recipients.length === 0) {
                hasMore = false;
                break;
            }

            for (const recipient of recipients) {
                const state = activeBroadcasts.get(broadcastId);
                if (!state || state.abortController.signal.aborted || state.paused) {
                    if (state?.paused) {
                        await prisma.broadcast.update({
                            where: { id: broadcastId },
                            data: { status: "PAUSED" },
                        });
                    }
                    return;
                }

                try {
                    if (isBotMode) {
                        await sendViaBotApi(recipient.telegramId, messageContent, messageButtons);
                    } else {
                        // Session mode — no inline buttons (only bots can send them)
                        await sendMessage(
                            broadcast.sessionId!,
                            recipient.telegramId,
                            {
                                message: messageContent,
                                parseMode: "html",
                                file: messageMedia?.[0]?.url,
                            },
                            logger,
                        );
                    }

                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: "SENT", sentAt: new Date() },
                    });
                    sentCount++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    // Handle FloodWait (MTProto) or rate limits (Bot API 429)
                    if (
                        errorMessage.includes("FloodWait") ||
                        errorMessage.includes("FLOOD_WAIT") ||
                        errorMessage.includes("429")
                    ) {
                        const waitMatch = /(\d+)/.exec(errorMessage);
                        const waitSeconds = waitMatch ? parseInt(waitMatch[1], 10) : 30;
                        logger.warn("BroadcastWorker: FloodWait/rate limit, sleeping", {
                            broadcastId,
                            waitSeconds,
                        });
                        await Bun.sleep(waitSeconds * 1000);
                        // Retry this recipient
                        try {
                            if (isBotMode) {
                                await sendViaBotApi(
                                    recipient.telegramId,
                                    messageContent,
                                    messageButtons,
                                );
                            } else {
                                await sendMessage(
                                    broadcast.sessionId!,
                                    recipient.telegramId,
                                    {
                                        message: messageContent,
                                        parseMode: "html",
                                        file: messageMedia?.[0]?.url,
                                    },
                                    logger,
                                );
                            }
                            await prisma.broadcastRecipient.update({
                                where: { id: recipient.id },
                                data: { status: "SENT", sentAt: new Date() },
                            });
                            sentCount++;
                        } catch (retryError) {
                            const retryMsg =
                                retryError instanceof Error
                                    ? retryError.message
                                    : String(retryError);
                            await prisma.broadcastRecipient.update({
                                where: { id: recipient.id },
                                data: { status: "FAILED", errorMessage: humanizeError(retryMsg) },
                            });
                            failedCount++;
                        }
                    } else {
                        logger.error("BroadcastWorker: Failed to send to recipient", {
                            broadcastId,
                            recipientId: recipient.id,
                            telegramId: recipient.telegramId,
                            error: errorMessage,
                        });
                        // Store user-friendly error, not raw technical message
                        const userError = humanizeError(errorMessage);
                        await prisma.broadcastRecipient.update({
                            where: { id: recipient.id },
                            data: { status: "FAILED", errorMessage: userError },
                        });
                        failedCount++;
                    }
                }

                // Rate limiting delay
                await Bun.sleep(SEND_DELAY_MS);
            }

            // Don't increment offset since we're filtering by PENDING status
            // and already-processed recipients change to SENT/FAILED
        }

        // Determine final status
        const finalStatus = failedCount > 0 && sentCount === 0 ? "FAILED" : "COMPLETED";
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: finalStatus, completedAt: new Date() },
        });

        logger.info("BroadcastWorker: Broadcast completed", {
            broadcastId,
            status: finalStatus,
            sentCount,
            failedCount,
        });
    } catch (error) {
        logger.error("BroadcastWorker: Broadcast execution error", { broadcastId, error });
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: "FAILED" },
        });
    } finally {
        activeBroadcasts.delete(broadcastId);
    }
}

/**
 * Pause an active broadcast.
 */
export function pauseBroadcast(broadcastId: number): boolean {
    const state = activeBroadcasts.get(broadcastId);
    if (!state) return false;
    state.paused = true;
    return true;
}

/**
 * Resume a paused broadcast.
 */
export function resumeBroadcast(broadcastId: number, logger: Logger): void {
    const state = activeBroadcasts.get(broadcastId);
    if (state) {
        state.paused = false;
    }
    // Re-execute to pick up remaining PENDING recipients
    void executeBroadcast(broadcastId, logger);
}

/**
 * Check if a broadcast is currently active.
 */
export function isBroadcastActive(broadcastId: number): boolean {
    return activeBroadcasts.has(broadcastId);
}
