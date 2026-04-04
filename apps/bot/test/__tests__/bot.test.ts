import { beforeEach, describe, expect, test, vi } from "vitest";

import { mockUser, prismaMock } from "../setup";

// Capture handler callbacks registered via bot.command() and bot.on()
const handlers = vi.hoisted(() => ({
    commands: {} as Record<string, (ctx: unknown) => Promise<void>>,
    events: {} as Record<string, (ctx: unknown) => Promise<void>>,
    errorHandler: undefined as ((err: unknown) => void) | undefined,
}));

// Hoist mock Grammy classes so they're accessible in both the mock factory and tests
const { MockGrammyError, MockHttpError } = vi.hoisted(() => ({
    MockGrammyError: class MockGrammyError extends Error {
        description: string;
        constructor(message: string) {
            super(message);
            this.description = message;
        }
    },
    MockHttpError: class MockHttpError extends Error {},
}));

// Mock grammy Bot to capture registered handlers
vi.mock("grammy", () => ({
    Bot: class MockBot {
        constructor() {}
        on(event: string, handler: (ctx: unknown) => Promise<void>) {
            handlers.events[event] = handler;
        }
        command(name: string, handler: (ctx: unknown) => Promise<void>) {
            handlers.commands[name] = handler;
        }
        catch(handler: (err: unknown) => void) {
            handlers.errorHandler = handler;
        }
        api = { setWebhook: vi.fn(() => Promise.resolve()) };
    },
    GrammyError: MockGrammyError,
    HttpError: MockHttpError,
    InlineKeyboard: class MockInlineKeyboard {
        buttons: { text: string; web_app?: { url: string }; url?: string }[][] = [];
        webApp(text: string, url: string) {
            this.buttons.push([{ text, web_app: { url } }]);
            return this;
        }
        row() {
            return this;
        }
        url(text: string, url: string) {
            this.buttons.push([{ text, url }]);
            return this;
        }
    },
}));

// Mock logger before importing bot — vi.hoisted so it's available in hoisted vi.mock factory
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
vi.mock("@bot/lib/logger", () => ({ logger: mockLogger }));

// Set token and webapp URL before bot.ts import
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.WEBAPP_URL = "https://test-shop.example.com";

import { bot } from "@bot/bot";

// Helper to create a mock grammy command context
function createCommandContext(fromId: number) {
    return {
        from: { id: fromId },
        reply: vi.fn((_text: string, _opts?: unknown): Promise<void> => Promise.resolve()),
        setChatMenuButton: vi.fn((_opts?: unknown): Promise<void> => Promise.resolve()),
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

    test("registers error handler via bot.catch()", () => {
        expect(handlers.errorHandler).toBeDefined();
    });

    test("error handler logs GrammyError with description", () => {
        const grammyErr = new MockGrammyError("Bad Request: message is too long");
        const err = { error: grammyErr, ctx: { update: { update_id: 42 } } };

        vi.mocked(mockLogger.error).mockClear();
        handlers.errorHandler!(err);

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Grammy API error",
            expect.objectContaining({
                description: "Bad Request: message is too long",
                updateId: 42,
            }),
        );
    });

    test("error handler logs unknown errors", () => {
        const err = { error: new Error("something broke"), ctx: { update: { update_id: 99 } } };

        vi.mocked(mockLogger.error).mockClear();
        handlers.errorHandler!(err);

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Unhandled error",
            expect.objectContaining({ updateId: 99 }),
        );
    });
});

describe("/start command handler", () => {
    beforeEach(() => {
        prismaMock.users.findFirst.mockReset();
    });

    test("shows contact keyboard and shop button when user has no phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        // 1st reply: contact keyboard, 2nd reply: shop button
        expect(ctx.reply).toHaveBeenCalledTimes(2);
        expect(ctx.reply).toHaveBeenNthCalledWith(
            1,
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
        expect(ctx.reply).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("Buyurtma berish"),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    buttons: expect.any(Array),
                }),
            }),
        );
    });

    test("shows welcome message with shop button when user already has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));

        const ctx = createCommandContext(100);
        await handlers.commands.start(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("xush kelibsiz"),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    buttons: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({
                                web_app: { url: "https://test-shop.example.com" },
                            }),
                        ]),
                    ]),
                }),
            }),
        );
    });

    test("uses Russian messages for ru-language user without phone", async () => {
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

    test("returns early when ctx.from is undefined", async () => {
        const ctx = { from: undefined, reply: vi.fn() };
        await handlers.commands.start(ctx);

        expect(ctx.reply).not.toHaveBeenCalled();
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

    test("shows shop button when user has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));

        const ctx = createCommandContext(100);
        await handlers.events.message(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply).toHaveBeenCalledWith(
            expect.stringContaining("tugmani bosing"),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    buttons: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({
                                web_app: { url: "https://test-shop.example.com" },
                            }),
                        ]),
                    ]),
                }),
            }),
        );
    });

    test("uses Russian messages for ru-language user without phone", async () => {
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

    test("returns early when ctx.from is undefined", async () => {
        const ctx = { from: undefined, reply: vi.fn() };
        await handlers.events.message(ctx);

        expect(ctx.reply).not.toHaveBeenCalled();
    });
});
