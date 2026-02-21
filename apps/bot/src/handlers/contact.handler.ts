import type { Context } from "grammy";
import { PhoneService } from "@bot/services/phone.service";
import { validatePhone, normalizePhone } from "@bot/lib/phone-validation";
import { prisma } from "@bot/lib/prisma";
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

async function getUserLanguage(telegramId: string): Promise<"uz" | "ru"> {
    try {
        const user = await prisma.users.findUnique({
            where: { telegramId },
            select: { language: true },
        });
        return user?.language === "ru" ? "ru" : "uz";
    } catch {
        return "uz";
    }
}

export async function handleContact(ctx: Context): Promise<void> {
    const contact = ctx.message?.contact;
    const fromUser = ctx.from;

    if (!contact || !fromUser) {
        // No telegramId available — fall back to bilingual
        await ctx.reply(
            messages.uz.processingError + "\n\n" + messages.ru.processingError,
        );
        return;
    }

    const telegramId = String(fromUser.id);
    const lang = await getUserLanguage(telegramId);
    const msg = messages[lang];

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
        logger.warn("Bot: Invalid phone format", { phone: rawPhone, telegramId: fromUser.id });
        await ctx.reply(msg.invalidPhone);
        return;
    }

    const phone = normalizePhone(rawPhone);

    const result = await PhoneService.savePhone(telegramId, phone, logger);

    if (result.success) {
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
}
