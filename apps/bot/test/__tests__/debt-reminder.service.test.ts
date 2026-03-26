import { beforeEach, describe, expect, test } from "vitest";

import { getDebtors } from "@bot/services/debt-reminder.service";

import { createMockLogger, prismaMock } from "../setup";

describe("getDebtors", () => {
    const mockLogger = createMockLogger();

    beforeEach(() => {
        prismaMock.$queryRaw.mockReset();
        prismaMock.$queryRaw.mockResolvedValue([]);
    });

    test("returns debtors with correct fields", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
            { id: 1, fullname: "Ali Valiyev", telegramId: "111", language: "uz", balance: 50000 },
        ]);

        const result = await getDebtors(mockLogger);

        expect(result).toEqual([
            { id: 1, fullname: "Ali Valiyev", telegramId: "111", language: "uz", balance: 50000 },
        ]);
    });

    test("returns multiple debtors", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
            { id: 1, fullname: "Ali", telegramId: "111", language: "uz", balance: 50000 },
            { id: 2, fullname: "Ivan", telegramId: "222", language: "ru", balance: 30000 },
            { id: 3, fullname: "Sardor", telegramId: "333", language: "uz", balance: 10000 },
        ]);

        const result = await getDebtors(mockLogger);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({ id: 1, fullname: "Ali" });
        expect(result[1]).toMatchObject({ id: 2, fullname: "Ivan" });
        expect(result[2]).toMatchObject({ id: 3, fullname: "Sardor" });
    });

    test("returns empty array when no debtors", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([]);

        const result = await getDebtors(mockLogger);

        expect(result).toEqual([]);
    });

    test("normalizes language to uz for non-ru values", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
            { id: 1, fullname: "Test", telegramId: "111", language: "en", balance: 5000 },
        ]);

        const result = await getDebtors(mockLogger);

        expect(result[0]?.language).toBe("uz");
    });

    test("keeps language ru as-is", async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
            { id: 1, fullname: "Ivan", telegramId: "222", language: "ru", balance: 5000 },
        ]);

        const result = await getDebtors(mockLogger);

        expect(result[0]?.language).toBe("ru");
    });

    test("returns empty array and logs error on DB failure", async () => {
        prismaMock.$queryRaw.mockRejectedValueOnce(new Error("Connection lost"));

        const result = await getDebtors(mockLogger);

        expect(result).toEqual([]);
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Bot: Failed to get debtors",
            expect.objectContaining({ error: expect.any(Error) }),
        );
    });
});
