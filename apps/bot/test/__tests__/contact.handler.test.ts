import { describe, test, expect, mock, beforeEach } from "bun:test";
import { prismaMock, createMockLogger } from "../setup";

// Mock the logger module before importing handler
const mockLogger = createMockLogger();
mock.module("@bot/lib/logger", () => ({ default: mockLogger }));

import { handleContact } from "@bot/handlers/contact.handler";

// Helper to create a mock grammY context
function createMockContext(overrides: {
    contact?: {
        phone_number: string;
        user_id: number;
        first_name: string;
    } | null;
    from?: { id: number } | null;
}) {
    return {
        message: overrides.contact !== undefined ? { contact: overrides.contact } : undefined,
        from: overrides.from !== undefined ? overrides.from : undefined,
        reply: mock(() => Promise.resolve()),
    } as any;
}

describe("handleContact", () => {
    beforeEach(() => {
        // Reset logger mocks
        (mockLogger.info as any).mockReset?.();
        (mockLogger.warn as any).mockReset?.();
        (mockLogger.error as any).mockReset?.();
    });

    test("saves phone and replies with success when own contact shared", async () => {
        // getUserLanguage lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "uz" } as any);
        // PhoneService lookups
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any)
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce({ id: 1, phone: "+998901234567" } as any);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = (ctx.reply as any).mock.calls[0];
        expect(replyCall[0]).toContain("saqlandi");
        expect(replyCall[1]).toEqual({ reply_markup: { remove_keyboard: true } });
    });

    test("rejects when user shares someone else's contact", async () => {
        // getUserLanguage lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "uz" } as any);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 200, first_name: "Other" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("o'zingizning");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("replies with error when contact is missing", async () => {
        const ctx = createMockContext({
            contact: null,
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        // Falls back to bilingual when no telegramId available
        expect(replyText).toContain("Kontaktni qayta ishlashda xatolik");
        expect(replyText).toContain("Ошибка обработки контакта");
    });

    test("replies with error when from is missing", async () => {
        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: null,
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("Kontaktni qayta ishlashda xatolik");
    });

    test("replies with invalid phone message for short numbers", async () => {
        // getUserLanguage lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "uz" } as any);

        const ctx = createMockContext({
            contact: { phone_number: "12345", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("noto'g'ri");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("replies with PHONE_TAKEN error from service", async () => {
        // getUserLanguage lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "uz" } as any);
        // PhoneService lookups
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any)
            .mockResolvedValueOnce({ id: 2 } as any); // phone taken by another user

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("boshqa akkauntga biriktirilgan");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("replies with USER_NOT_FOUND error from service", async () => {
        // getUserLanguage lookup — user not found, defaults to uz
        prismaMock.users.findUnique.mockResolvedValueOnce(null);
        // PhoneService lookup — also not found
        prismaMock.users.findUnique.mockResolvedValueOnce(null);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("topilmadi");
    });

    test("replies with ALREADY_HAS_PHONE error from service", async () => {
        // getUserLanguage lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "uz" } as any);
        // PhoneService lookup
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: 1,
            phone: "+998901111111",
        } as any);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = (ctx.reply as any).mock.calls[0][0];
        expect(replyText).toContain("allaqachon saqlangan");
    });

    test("sends Russian messages when user language is ru", async () => {
        // getUserLanguage lookup — Russian user
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "ru" } as any);
        // PhoneService lookups
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any)
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce({ id: 1, phone: "+998901234567" } as any);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = (ctx.reply as any).mock.calls[0];
        expect(replyCall[0]).toContain("сохранён");
        expect(replyCall[0]).not.toContain("saqlandi");
    });

    test("defaults to Uzbek when user language is unknown", async () => {
        // getUserLanguage lookup — unknown language
        prismaMock.users.findUnique.mockResolvedValueOnce({ id: 1, language: "en" } as any);
        // PhoneService lookups
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any)
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce({ id: 1, phone: "+998901234567" } as any);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = (ctx.reply as any).mock.calls[0];
        expect(replyCall[0]).toContain("saqlandi");
    });
});
