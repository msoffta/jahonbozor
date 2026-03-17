import { Bot } from "grammy";
import { handleContact } from "@bot/handlers/contact.handler";
import { getUserInfo } from "@bot/services/user.service";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
}

const bot = new Bot(botToken);

const botMessages = {
    uz: {
        start: "Assalomu alaykum! Buyurtmalaringiz bo'yicha siz bilan bog'lanishimiz uchun telefon raqamingizni ulashing.",
        startWithPhone: "Assalomu alaykum! Telefon raqamingiz saqlangan. Rahmat!",
        generic: "Iltimos, quyidagi tugma orqali telefon raqamingizni ulashing.",
        genericWithPhone: "Telefon raqamingiz allaqachon saqlangan. Rahmat!",
        shareButton: "📱 Raqamni ulashish",
    },
    ru: {
        start: "Здравствуйте! Поделитесь номером телефона, чтобы мы могли связаться с вами по заказам.",
        startWithPhone: "Здравствуйте! Ваш номер телефона сохранён. Спасибо!",
        generic: "Пожалуйста, поделитесь номером телефона через кнопку ниже.",
        genericWithPhone: "Ваш номер телефона уже сохранён. Спасибо!",
        shareButton: "📱 Поделиться номером",
    },
};

const contactKeyboard = (lang: "uz" | "ru") => ({
    keyboard: [[{ text: botMessages[lang].shareButton, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
});

bot.on("message:contact", handleContact);

bot.command("start", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const { language, phone } = await getUserInfo(telegramId);

    if (phone) {
        await ctx.reply(botMessages[language].startWithPhone);
    } else {
        await ctx.reply(botMessages[language].start, {
            reply_markup: contactKeyboard(language),
        });
    }
});

bot.on("message", async (ctx) => {
    const telegramId = String(ctx.from?.id);
    const { language, phone } = await getUserInfo(telegramId);

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

// Re-export getUserInfo for backward compatibility
export { bot, getUserInfo };
