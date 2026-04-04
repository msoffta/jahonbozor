import { shopKeyboard } from "@bot/lib/keyboards";
import { logger } from "@bot/lib/logger";
import { botMessages, contactMessages } from "@bot/lib/messages";
import { normalizePhone, validatePhone } from "@bot/lib/phone-validation";
import { savePhone } from "@bot/services/phone.service";
import { getUserInfo } from "@bot/services/user.service";

import type { Context } from "grammy";

export async function handleContact(ctx: Context): Promise<void> {
    try {
        const contact = ctx.message?.contact;
        const fromUser = ctx.from;

        if (!contact || !fromUser) {
            await ctx.reply(
                contactMessages.uz.processingError + "\n\n" + contactMessages.ru.processingError,
            );
            return;
        }

        const telegramId = String(fromUser.id);
        const { language } = await getUserInfo(telegramId, logger);
        const msg = contactMessages[language];

        if (contact.user_id !== fromUser.id) {
            logger.warn("Bot: User shared someone else's contact", {
                fromUserId: fromUser.id,
                contactUserId: contact.user_id,
            });
            await ctx.reply(msg.wrongContact);
            return;
        }

        const rawPhone = contact.phone_number;

        if (!validatePhone(rawPhone)) {
            logger.warn("Bot: Invalid phone format", { telegramId: fromUser.id });
            await ctx.reply(msg.invalidPhone);
            return;
        }

        const phone = normalizePhone(rawPhone);

        const result = await savePhone(telegramId, phone, logger);

        if (result.success) {
            logger.info("Bot: Phone saved successfully", { telegramId });
            await ctx.reply(msg.success, {
                reply_markup: { remove_keyboard: true },
            });
            const shop = shopKeyboard(language);
            if (shop) {
                await ctx.reply(botMessages[language].shopPrompt, {
                    reply_markup: shop,
                });
            }
        } else if (result.error === "PHONE_TAKEN") {
            await ctx.reply(msg.phoneTaken, {
                reply_markup: { remove_keyboard: true },
            });
        } else if (result.error === "USER_NOT_FOUND") {
            await ctx.reply(msg.userNotFound, {
                reply_markup: { remove_keyboard: true },
            });
        } else if (result.error === "ALREADY_HAS_PHONE") {
            await ctx.reply(msg.alreadyHasPhone, {
                reply_markup: { remove_keyboard: true },
            });
        } else {
            await ctx.reply(msg.genericError, {
                reply_markup: { remove_keyboard: true },
            });
        }
    } catch (error) {
        logger.error("Bot: Failed to handle contact", { error });
        try {
            await ctx.reply(
                contactMessages.uz.genericError + "\n\n" + contactMessages.ru.genericError,
            );
        } catch (replyError) {
            logger.error("Bot: Failed to send error reply", { error: replyError });
        }
    }
}
