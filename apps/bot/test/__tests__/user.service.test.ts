import { beforeEach, describe, expect, test } from "vitest";

import { getUserInfo } from "@bot/services/user.service";

import { createMockLogger, mockUser, prismaMock } from "../setup";

describe("getUserInfo", () => {
    const mockLogger = createMockLogger();

    beforeEach(() => {
        prismaMock.users.findFirst.mockReset();
        prismaMock.users.findFirst.mockResolvedValue(null);
    });

    test("calls prisma.users.findFirst with correct telegramId and deletedAt filter", async () => {
        await getUserInfo("123456", mockLogger);

        expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
            where: { telegramId: "123456", deletedAt: null },
            select: { language: true, phone: true },
        });
    });

    test("returns user with phone when user exists and has phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(
            mockUser({ language: "uz", phone: "+998901234567" }),
        );

        const result = await getUserInfo("123", mockLogger);

        expect(result).toEqual({ language: "uz", phone: "+998901234567" });
    });

    test("returns language ru when user.language is ru", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(
            mockUser({ language: "ru", phone: "+998901234567" }),
        );

        const result = await getUserInfo("123", mockLogger);

        expect(result).toEqual({ language: "ru", phone: "+998901234567" });
    });

    test("defaults language to uz when user.language is unknown", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ language: "en" }));

        const result = await getUserInfo("123", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns phone null when user has no phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser());

        const result = await getUserInfo("123", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults when user not found", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("999", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults when user is soft-deleted (deletedAt filter excludes them)", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("deleted-user-id", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
    });

    test("returns defaults and logs error on DB failure", async () => {
        prismaMock.users.findFirst.mockRejectedValueOnce(new Error("Connection lost"));

        const result = await getUserInfo("123", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Failed to get user info",
            expect.objectContaining({ telegramId: "123" }),
        );
    });

    // Edge cases
    test("returns defaults for empty telegramId", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo("", mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
        expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { telegramId: "", deletedAt: null } }),
        );
    });

    test("handles very long telegramId", async () => {
        const longId = "9".repeat(100);
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await getUserInfo(longId, mockLogger);

        expect(result).toEqual({ language: "uz", phone: null });
        expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { telegramId: longId, deletedAt: null } }),
        );
    });
});
