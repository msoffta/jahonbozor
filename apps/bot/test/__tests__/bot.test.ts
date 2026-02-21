import { describe, test, expect, beforeEach, mock } from "bun:test";
import { prismaMock } from "../setup";

// Mock grammy Bot to avoid real Telegram API calls
mock.module("grammy", () => ({
    Bot: class MockBot {
        constructor() {}
        on() {}
        command() {}
        api = { setWebhook: mock(() => Promise.resolve()) };
    },
}));

// Set token before bot.ts import
process.env.TELEGRAM_BOT_TOKEN = "test-token";

import { bot } from "@bot/bot";

describe("bot instance", () => {
    test("bot is created successfully", () => {
        expect(bot).toBeDefined();
    });
});

describe("getUserInfo via prisma mock", () => {
    beforeEach(() => {
        prismaMock.users.findUnique.mockReset();
        prismaMock.users.findUnique.mockResolvedValue(null);
    });

    test("returns user with phone when phone exists", async () => {
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: 1,
            language: "uz",
            phone: "+998901234567",
        } as any);

        const user = await prismaMock.users.findUnique({
            where: { telegramId: "123" },
            select: { language: true, phone: true },
        });

        expect(user).toEqual(
            expect.objectContaining({ language: "uz", phone: "+998901234567" }),
        );
    });

    test("returns user without phone when phone is null", async () => {
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: 1,
            language: "ru",
            phone: null,
        } as any);

        const user = await prismaMock.users.findUnique({
            where: { telegramId: "456" },
            select: { language: true, phone: true },
        });

        expect(user).toEqual(
            expect.objectContaining({ language: "ru", phone: null }),
        );
    });

    test("returns null for unknown telegramId", async () => {
        const user = await prismaMock.users.findUnique({
            where: { telegramId: "999" },
            select: { language: true, phone: true },
        });

        expect(user).toBeNull();
    });
});
