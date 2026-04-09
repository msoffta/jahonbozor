import { InlineKeyboard } from "grammy";

import { botMessages } from "@bot/lib/messages";

import type { Language } from "@jahonbozor/schemas";

export const contactKeyboard = (lang: Language) => ({
    keyboard: [[{ text: botMessages[lang].shareButton, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
});

export const shopKeyboard = (lang: Language) => {
    const url = process.env.WEBAPP_URL;
    if (!url) return undefined;
    return new InlineKeyboard().webApp(botMessages[lang].openShop, url);
};

export const menuButton = (lang: Language) => {
    const url = process.env.WEBAPP_URL;
    if (!url) return undefined;
    return {
        type: "web_app" as const,
        text: botMessages[lang].menuButton,
        web_app: { url },
    };
};
