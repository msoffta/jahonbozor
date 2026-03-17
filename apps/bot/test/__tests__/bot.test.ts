import { describe, test, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockUser } from "../setup";

// Capture handler callbacks registered via bot.command() and bot.on()
const handlers = vi.hoisted(() => ({
    commands: {} as Record<string, Function>,
    events: {} as Record<string, Function>,
}));

// Mock grammy Bot to capture registered handlers
vi.mock("grammy", () => ({
    Bot: class MockBot {
        constructor() {}
        on(event: string, handler: Function) {
            handlers.events[event] = handler;
        }
        command(name: string, handler: Function) {
            handlers.commands[name] = handler;
        }
        api = { setWebhook: vi.fn(() => Promise.resolve()) };
    },
}));

// Mock logger before importing bot — vi.hoisted so it's available in hoisted vi.mock factory
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
vi.mock("@bot/lib/logger", () => ({ default: mockLogger }));

// Set token before bot.ts import
process.env.TELEGRAM_BOT_TOKEN = "test-token";

import { bot, getUserInfo } from "@bot/bot";

// Helper to create a mock grammy command context
function createCommandContext(fromId: number) {
    return {
        from: { id: fromId },
        reply: vi.fn((_text: string, _opts?: unknown): Promise<void> => Promise.resolve()),
    };
}

describe("bot instance", () => {
    test("bot is created successfully", () => {
        expect(bot).toBeDefined();
    });

    test("registers /start command handler", () => {
        expect(handlers.commands.start).toBeDefined();
    });

    test("registers message:contact handler", () => {
        expect(handlers.events["message:contact"]).toBeDefined();
    });

    test("registers generic message handler", () => {
        expect(handlers.events.message).toBeDefined();
    });
});

describe("getUserInfo", () => {
    beforeEach(() => {
        prismaMock.users.findFirst.mockReset();
        prismaMock.users.findFirst.mockResolvedValue(null);
        vi.mocked(mockLogger.error).mockReset();
    });

    test("calls prisma.users.findFirst with correct telegramId and deletedAt filter", async () => {
        await getUserInfo("123456");

        expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
            where: { telegramId: "123456", deletedAt: null },
            select: { language: true, phone: true },
        });
    });

    test("returns user with phone when user exists and has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(
            mockUser({ language: "uz", phone: "+998901234567" }),
        );

        const result = await getUserInfo("123");

        expect(result).toEqual({ language: "uz", phone: "+998901234567" });
    });

    test("returns language ru when user.language is ru", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(
            mockUser({ language: "ru", phone: "+998901234567" }),
        );

        const result = await getUserInfo("123");

        expect(result).toEqual({ language: "ru", phone: "+998901234567" });
    });

    test("defaults language to uz when user.language is unknown", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(
            mockUser({ language: "en" }),
        );

        const result = await getUserInfo("123");

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns phone null when user has no phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const result = await getUserInfo("123");

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults when user not found", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("999");

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults when user is soft-deleted (deletedAt filter excludes them)", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("deleted-user-id");

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults and logs error on DB failure", async () => {
        prismaMock.users.findFirst.mockRejectedValueOnce(new Error("Connection lost"));

        const result = await getUserInfo("123");

        expect(result).toEqual({ language: "uz", phone: null });
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Failed to get user info",
            expect.objectContaining({ telegramId: "123" }),
        );
    });

    // Edge cases
    test("returns defaults for empty telegramId", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("");

        expect(result).toEqual({ language: "uz", phone: null });
        expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { telegramId: "", deletedAt: null } }),
        );
    });

    test("handles very long telegramId", async () => {
        const longId = "9".repeat(100);
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo(longId);

        expect(result).toEqual({ language: "uz", phone: null });
        expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { telegramId: longId, deletedAt: null } }),
        );
    });
});

describe("/start command handler", () => {
    beforeEach(() => {
        prismaMock.users.findFirst.mockReset();
    });

    test("shows keyboard when user has no phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("Assalomu alaykum"),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    keyboard: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({ request_contact: true }),
                        ]),
                    ]),
                }),
            }),
        );
    });

    test("shows phone-saved message when user already has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("saqlangan"));
    });

    test("uses Russian messages for ru-language user", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ language: "ru" }));

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("Здравствуйте"),
            expect.anything(),
        );
    });

    test("defaults to Uzbek for unknown user", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("Assalomu alaykum"),
            expect.objectContaining({ reply_markup: expect.anything() }),
        );
    });
});

describe("generic message handler", () => {
    beforeEach(() => {
        prismaMock.users.findFirst.mockReset();
    });

    test("shows keyboard when user has no phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createCommandContext(100);
        await handlers.events.message(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("tugma orqali"),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    keyboard: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({ request_contact: true }),
                        ]),
                    ]),
                }),
            }),
        );
    });

    test("shows phone-saved message and removes keyboard when user has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));

        const ctx = createCommandContext(100);
        await handlers.events.message(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("allaqachon saqlangan"),
            { reply_markup: { remove_keyboard: true } },
        );
    });

    test("uses Russian messages for ru-language user", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ language: "ru" }));

        const ctx = createCommandContext(100);
        await handlers.events.message(ctx);

        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("Пожалуйста"),
            expect.anything(),
        );
    });

    test("defaults to Uzbek for unknown user", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const ctx = createCommandContext(100);
        await handlers.events.message(ctx);

        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("tugma orqali"),
            expect.objectContaining({ reply_markup: expect.anything() }),
        );
    });
});
