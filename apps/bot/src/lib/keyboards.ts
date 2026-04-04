import { InlineKeyboard } from "grammy";

import { botMessages } from "@bot/lib/messages";

import type { Language } from "@jahonbozor/schemas";

const webAppUrl = process.env.WEBAPP_URL;

export const contactKeyboard = (lang: Language) => ({
    keyboard: [[{ text: botMessages[lang].shareButton, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
});

export const shopKeyboard = (lang: Language) => {
    if (!webAppUrl) return undefined;
    return new InlineKeyboard().webApp(botMessages[lang].openShop, webAppUrl);
};

export const menuButton = (lang: Language) => {
    if (!webAppUrl) return undefined;
    return {
        type: "web_app" as const,
        text: botMessages[lang].menuButton,
        web_app: { url: webAppUrl },
    };
};
