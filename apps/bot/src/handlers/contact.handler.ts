import type { Context } from "grammy";
import { savePhone } from "@bot/services/phone.service";
import { validatePhone, normalizePhone } from "@bot/lib/phone-validation";
import { getUserInfo } from "@bot/services/user.service";
import logger from "@bot/lib/logger";

const messages = {
    uz: {
        processingError: "Kontaktni qayta ishlashda xatolik. Qayta urinib ko'ring.",
        wrongContact: "Iltimos, o'zingizning kontaktingizni ulashing.",
        invalidPhone: "Telefon raqam formati noto'g'ri. Qayta urinib ko'ring.",
        success: "Rahmat! Telefon raqamingiz saqlandi.",
        phoneTaken: "Bu raqam boshqa akkauntga biriktirilgan. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
        userNotFound: "Akkauntingiz topilmadi. Avval saytga kiring.",
        alreadyHasPhone: "Telefon raqamingiz allaqachon saqlangan!",
        genericError: "Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    },
    ru: {
        processingError: "Ошибка обработки контакта. Попробуйте ещё раз.",
        wrongContact: "Пожалуйста, поделитесь своим контактом, а не чужим.",
        invalidPhone: "Неверный формат номера. Попробуйте ещё раз.",
        success: "Спасибо! Ваш номер телефона сохранён.",
        phoneTaken: "Этот номер уже привязан к другому аккаунту. Обратитесь в поддержку.",
        userNotFound: "Аккаунт не найден. Сначала войдите на сайт.",
        alreadyHasPhone: "Ваш номер телефона уже сохранён!",
        genericError: "Произошла ошибка. Попробуйте позже.",
    },
};

export async function handleContact(ctx: Context): Promise<void> {
    try {
        const contact = ctx.message?.contact;
        const fromUser = ctx.from;

        if (!contact || !fromUser) {
            await ctx.reply(
                messages.uz.processingError + "\n\n" + messages.ru.processingError,
            );
            return;
        }

        const telegramId = String(fromUser.id);
        const { language } = await getUserInfo(telegramId);
        const msg = messages[language];

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
    }
}
