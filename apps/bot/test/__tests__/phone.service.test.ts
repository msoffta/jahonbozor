import { describe, test, expect } from "bun:test";
import { prismaMock, createMockLogger } from "../setup";
import { PhoneService } from "@bot/services/phone.service";

describe("PhoneService.savePhone", () => {
    const logger = createMockLogger();

    test("saves phone when user exists and has no phone", async () => {
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any) // find by telegramId
            .mockResolvedValueOnce(null); // check phone not taken
        prismaMock.users.update.mockResolvedValueOnce({ id: 1, phone: "+998901234567" } as any);

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: true });
        expect(prismaMock.users.findUnique).toHaveBeenCalledTimes(2);
        expect(prismaMock.users.update).toHaveBeenCalledTimes(1);
    });

    test("returns USER_NOT_FOUND when telegramId not in database", async () => {
        prismaMock.users.findUnique.mockResolvedValueOnce(null);

        const result = await PhoneService.savePhone("999999", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "USER_NOT_FOUND" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("returns ALREADY_HAS_PHONE when user already has a phone", async () => {
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: 1,
            phone: "+998901111111",
        } as any);

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "ALREADY_HAS_PHONE" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("returns PHONE_TAKEN when phone belongs to another user", async () => {
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any) // find by telegramId
            .mockResolvedValueOnce({ id: 2 } as any); // phone taken by user id=2

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "PHONE_TAKEN" });
        expect(prismaMock.users.update).not.toHaveBeenCalled();
    });

    test("succeeds when phone belongs to the same user", async () => {
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any) // find by telegramId
            .mockResolvedValueOnce({ id: 1 } as any); // same user id
        prismaMock.users.update.mockResolvedValueOnce({ id: 1, phone: "+998901234567" } as any);

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: true });
        expect(prismaMock.users.update).toHaveBeenCalledTimes(1);
    });

    test("returns DB_ERROR when prisma throws", async () => {
        prismaMock.users.findUnique.mockRejectedValueOnce(new Error("DB connection lost"));

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "DB_ERROR" });
    });

    test("returns DB_ERROR when update throws unique constraint", async () => {
        prismaMock.users.findUnique
            .mockResolvedValueOnce({ id: 1, phone: null } as any)
            .mockResolvedValueOnce(null);
        prismaMock.users.update.mockRejectedValueOnce(new Error("Unique constraint failed on phone"));

        const result = await PhoneService.savePhone("123456", "+998901234567", logger);

        expect(result).toEqual({ success: false, error: "DB_ERROR" });
    });
});
