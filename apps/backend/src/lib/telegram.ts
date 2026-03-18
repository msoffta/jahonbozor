import type { Logger } from "@jahonbozor/logger";

const messages = {
    uz: {
        text: "Assalomu alaykum! Buyurtmalaringiz bo'yicha siz bilan bog'lanishimiz uchun telefon raqamingizni ulashing.",
        button: "📱 Raqamni ulashish",
    },
    ru: {
        text: "Здравствуйте! Поделитесь номером телефона, чтобы мы могли связаться с вами по заказам.",
        button: "📱 Поделиться номером",
    },
};

/**
 * Sends a "Share Contact" keyboard button to a user via Telegram Bot API.
 * Called by the backend after Telegram auth when user has no phone.
 * Fire-and-forget: does not block the auth response.
 */
export async function sendContactRequest(
    telegramChatId: string,
    language: string,
    logger: Logger,
): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        logger.error("Telegram: BOT_TOKEN not configured");
        return false;
    }

    const lang = language === "ru" ? "ru" : "uz";
    const msg = messages[lang];

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: msg.text,
                reply_markup: {
                    keyboard: [[{ text: msg.button, request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            logger.warn("Telegram: Failed to send contact request", {
                telegramChatId,
                status: response.status,
                error: errorBody,
            });
            return false;
        }

        const responseBody: unknown = await response.json();
        logger.info("Telegram: Contact request sent", { telegramChatId, response: responseBody });
        return true;
    } catch (error) {
        logger.error("Telegram: Error sending contact request", { telegramChatId, error });
        return false;
    }
}
