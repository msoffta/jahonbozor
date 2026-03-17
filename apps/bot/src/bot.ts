import { Bot, GrammyError, HttpError } from "grammy";

import { handleContact } from "@bot/handlers/contact.handler";
import { logger } from "@bot/lib/logger";
import { botMessages } from "@bot/lib/messages";
import { getUserInfo } from "@bot/services/user.service";

import type { Language } from "@jahonbozor/schemas";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
}

const bot = new Bot(botToken);

const contactKeyboard = (lang: Language) => ({
    keyboard: [[{ text: botMessages[lang].shareButton, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
});

bot.on("message:contact", handleContact);

bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const telegramId = String(ctx.from.id);
    const { language, phone } = await getUserInfo(telegramId, logger);

    if (phone) {
        await ctx.reply(botMessages[language].startWithPhone);
    } else {
        await ctx.reply(botMessages[language].start, {
            reply_markup: contactKeyboard(language),
        });
    }
});

bot.on("message", async (ctx) => {
    if (!ctx.from) return;
    const telegramId = String(ctx.from.id);
    const { language, phone } = await getUserInfo(telegramId, logger);

    if (phone) {
        await ctx.reply(botMessages[language].genericWithPhone, {
            reply_markup: { remove_keyboard: true },
        });
    } else {
        await ctx.reply(botMessages[language].generic, {
            reply_markup: contactKeyboard(language),
        });
    }
});

bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) {
        logger.error("Bot: Grammy API error", {
            description: e.description,
            updateId: err.ctx.update.update_id,
        });
    } else if (e instanceof HttpError) {
        logger.error("Bot: Network error", { error: e, updateId: err.ctx.update.update_id });
    } else {
        logger.error("Bot: Unhandled error", { error: e, updateId: err.ctx.update.update_id });
    }
});

export { bot };
