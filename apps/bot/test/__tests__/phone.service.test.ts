import { describe, test, expect } from "vitest";
import { prismaMock, createMockLogger, mockUser, mockAuditLog } from "../setup";
import { savePhone } from "@bot/services/phone.service";

describe("savePhone", () => {
    const logger = createMockLogger();

    test("saves phone when user exists and has no phone", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser()) // find by telegramId
            .mockResolvedValueOnce(null); // check phone not taken
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: true });
        expect(prismaMock.users.findFirst).toHaveBeenCalledTimes(2);
        expect(prismaMock.users.update).toHaveBeenCalledTimes(1);
    });

    test("queries users with deletedAt: null filter", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        await savePhone("123456", "+998901234567", logger);

        expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ telegramId: "123456", deletedAt: null }),
            }),
        );
    });

    test("checks phone availability excluding deleted users", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        await savePhone("123456", "+998901234567", logger);

        const secondCall = prismaMock.users.findFirst.mock.calls[1];
        expect(secondCall[0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({ phone: "+998901234567", deletedAt: null }),
            }),
        );
    });

    test("returns USER_NOT_FOUND when telegramId not in database", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await savePhone("999999", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "USER_NOT_FOUND" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("returns USER_NOT_FOUND when user is soft-deleted", async () => {
        // findFirst with deletedAt: null won't find soft-deleted users
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await savePhone("deleted-user", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "USER_NOT_FOUND" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("returns ALREADY_HAS_PHONE when user already has a phone", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(mockUser({ phone: "+998901111111" }));

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "ALREADY_HAS_PHONE" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("returns PHONE_TAKEN when phone belongs to another user", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser()) // find by telegramId
            .mockResolvedValueOnce(mockUser({ id: 2 })); // phone taken by user id=2

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "PHONE_TAKEN" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("succeeds when phone belongs to the same user", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser()) // find by telegramId
            .mockResolvedValueOnce(mockUser()); // same user id
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: true });
        expect(prismaMock.users.update).toHaveBeenCalledTimes(1);
    });

    test("creates audit log entry on successful phone save", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        await savePhone("123456", "+998901234567", logger);

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: 1,
                actorType: "USER",
                entityType: "Users",
                entityId: 1,
                action: "UPDATE",
                previousData: { phone: null },
                newData: { phone: "+998901234567" },
            }),
        });
    });

    test("does not create audit log on failure", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null); // user not found

        await savePhone("999999", "+998901234567", logger);

        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    test("returns DB_ERROR when prisma throws", async () => {
        prismaMock.users.findFirst.mockRejectedValueOnce(new Error("DB connection lost"));

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "DB_ERROR" });
    });

    test("returns DB_ERROR when update throws generic error", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockRejectedValueOnce(new Error("Connection timeout"));

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "DB_ERROR" });
    });

    test("returns PHONE_TAKEN when update throws unique constraint violation", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockRejectedValueOnce(
            new Error("Unique constraint failed on the fields: (`phone`)"),
        );

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "PHONE_TAKEN" });
    });

    test("uses $transaction for atomic operations", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "+998901234567" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        await savePhone("123456", "+998901234567", logger);

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    test("returns DB_ERROR when $transaction itself throws", async () => {
        prismaMock.$transaction.mockRejectedValueOnce(new Error("Transaction failed"));

        const result = await savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "DB_ERROR" });
    });

    // Edge cases
    test("returns USER_NOT_FOUND for empty telegramId", async () => {
        prismaMock.users.findFirst.mockResolvedValueOnce(null);

        const result = await savePhone("", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "USER_NOT_FOUND" });
    });

    test("passes empty phone string to prisma when given empty phone", async () => {
        prismaMock.users.findFirst
            .mockResolvedValueOnce(mockUser())
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockResolvedValueOnce(mockUser({ phone: "" }));
        prismaMock.auditLog.create.mockResolvedValueOnce(mockAuditLog());

        const result = await savePhone("123456", "", logger);

        expect(result).toEqual({ success: true });
        expect(prismaMock.users.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { phone: "" } }),
        );
    });
});
