import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { createMockLogger } from "@backend/test/setup";
import { sendContactRequest } from "@backend/lib/telegram";

// Save original env and fetch
const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
const originalFetch = globalThis.fetch;

describe("sendContactRequest", () => {
    const logger = createMockLogger();

    beforeEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    });

    afterEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = originalEnv;
        globalThis.fetch = originalFetch;
    });

    test("sends message and returns true on success", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        ) as any;

        const result = await sendContactRequest("123456", "uz", logger);

        expect(result).toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        const callArgs = (globalThis.fetch as any).mock.calls[0];
        expect(callArgs[0]).toContain("test-bot-token");
        expect(callArgs[0]).toContain("/sendMessage");

        const body = JSON.parse(callArgs[1].body);
        expect(body.chat_id).toBe("123456");
        expect(body.reply_markup.keyboard[0][0].request_contact).toBe(true);
    });

    test("returns false when bot token is not configured", async () => {
        process.env.TELEGRAM_BOT_TOKEN = "";

        const result = await sendContactRequest("123456", "uz", logger);

        expect(result).toBe(false);
    });

    test("returns false when fetch returns non-OK status", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response("Bad Request", { status: 400 })),
        ) as any;

        const result = await sendContactRequest("123456", "uz", logger);

        expect(result).toBe(false);
    });

    test("returns false when fetch throws network error", async () => {
        globalThis.fetch = mock(() => Promise.reject(new Error("Network error"))) as any;

        const result = await sendContactRequest("123456", "uz", logger);

        expect(result).toBe(false);
    });

    test("sends Uzbek text when language is uz", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        ) as any;

        await sendContactRequest("123456", "uz", logger);

        const callArgs = (globalThis.fetch as any).mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain("telefon");
        expect(body.text).not.toContain("телефон");
        expect(body.reply_markup.keyboard[0][0].text).toContain("ulashish");
    });

    test("sends Russian text when language is ru", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        ) as any;

        await sendContactRequest("123456", "ru", logger);

        const callArgs = (globalThis.fetch as any).mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain("телефон");
        expect(body.text).not.toContain("telefon");
        expect(body.reply_markup.keyboard[0][0].text).toContain("Поделиться");
    });

    test("defaults to Uzbek for unknown language", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        ) as any;

        await sendContactRequest("123456", "unknown", logger);

        const callArgs = (globalThis.fetch as any).mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain("telefon");
    });

    test("sets resize_keyboard and one_time_keyboard", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        ) as any;

        await sendContactRequest("123456", "uz", logger);

        const callArgs = (globalThis.fetch as any).mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.reply_markup.resize_keyboard).toBe(true);
        expect(body.reply_markup.one_time_keyboard).toBe(true);
    });
});
