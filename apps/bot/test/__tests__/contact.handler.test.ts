import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Context } from "grammy";
import { prismaMock, mockUser, mockAuditLog } from "../setup";

// Mock the logger module before importing handler — vi.hoisted so it's available in hoisted vi.mock factory
const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));
vi.mock("@bot/lib/logger", () => ({ default: mockLogger }));

import { handleContact } from "@bot/handlers/contact.handler";

// Helper to create a mock grammY context — single boundary cast for external library type
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
        reply: vi.fn(() => Promise.resolve()),
    } as unknown as Context & { reply: ReturnType<typeof vi.fn> };
}

describe("handleContact", () => {
    beforeEach(() => {
        vi.mocked(mockLogger.info).mockReset();
        vi.mocked(mockLogger.warn).mockReset();
        vi.mocked(mockLogger.error).mockReset();
    });

    test("saves phone and replies with success when own contact shared", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());
        // PhoneService lookups
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = vi.mocked(ctx.reply).mock.calls[0];
        expect(replyCall[0]).toContain("saqlandi");
        expect(replyCall[1]).toEqual({ reply_markup: { remove_keyboard: true } });
    });

    test("rejects when user shares someone else's contact", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 200, first_name: "Other" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
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
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
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
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("Kontaktni qayta ishlashda xatolik");
    });

    test("replies with invalid phone message for short numbers", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createMockContext({
            contact: { phone_number: "12345", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("noto'g'ri");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("replies with PHONE_TAKEN error from service", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());
        // PhoneService lookups
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(mockUser({ id: 2 })); // phone taken by another user

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("boshqa akkauntga biriktirilgan");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("replies with USER_NOT_FOUND error from service", async () => {
        // getUserInfo lookup — user not found, defaults to uz
        prismaMock.users.findFirst.mockResolvedValueOnce(null);
        // PhoneService lookup — also not found
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("topilmadi");
    });

    test("replies with ALREADY_HAS_PHONE error from service", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());
        // PhoneService lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901111111" }));

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("allaqachon saqlangan");
    });

    test("sends Russian messages when user language is ru", async () => {
        // getUserInfo lookup — Russian user
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ language: "ru" }));
        // PhoneService lookups
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = vi.mocked(ctx.reply).mock.calls[0];
        expect(replyCall[0]).toContain("сохранён");
        expect(replyCall[0]).not.toContain("saqlandi");
    });

    test("defaults to Uzbek when user language is unknown", async () => {
        // getUserInfo lookup — unknown language
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ language: "en" }));
        // PhoneService lookups
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyCall = vi.mocked(ctx.reply).mock.calls[0];
        expect(replyCall[0]).toContain("saqlandi");
    });

    test("replies with generic error when service returns DB_ERROR", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());
        // PhoneService — $transaction throws
        prismaMock.$transaction.mockRejectedValueOnce(new Error("Connection lost"));

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("Xatolik yuz berdi");
    });

    test("does not throw when ctx.reply fails", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());
        // PhoneService lookups
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });
        // Make ctx.reply throw (Telegram API failure)
        vi.mocked(ctx.reply).mockRejectedValueOnce(new Error("Telegram API unavailable"));

        await expect(handleContact(ctx)).resolves.toBeUndefined();
        expect(mockLogger.error).toHaveBeenCalled();
    });

    test("defaults to uz and logs error when getUserInfo DB fails", async () => {
        // getUserInfo lookup — DB error → returns defaults { language: "uz", phone: null }
        prismaMock.users.findFirst.mockRejectedValueOnce(new Error("DB error"));
        // PhoneService lookups (falls back to uz)
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        // Should fall back to Uzbek
        expect(replyText).toContain("saqlandi");
        // getUserInfo logs error (not warn) on DB failure
        expect(mockLogger.error).toHaveBeenCalled();
    });

    // Edge cases
    test("rejects empty phone_number from contact", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createMockContext({
            contact: { phone_number: "", user_id: 100, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("noto'g'ri");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("rejects when contact user_id is 0 (different from from.id)", async () => {
        // getUserInfo lookup
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const ctx = createMockContext({
            contact: { phone_number: "+998901234567", user_id: 0, first_name: "Test" },
            from: { id: 100 },
        });

        await handleContact(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const replyText = vi.mocked(ctx.reply).mock.calls[0][0];
        expect(replyText).toContain("o'zingizning");
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });
});
