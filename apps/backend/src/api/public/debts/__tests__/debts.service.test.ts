import { beforeEach, describe, expect, test } from "vitest";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { PublicDebtsService } from "../debts.service";

import type { DebtPayment } from "@backend/generated/prisma/client";

const createMockDebtPayment = (overrides: Partial<DebtPayment> = {}): DebtPayment => ({
    id: 1,
    orderId: 1,
    userId: 10,
    amount: 5000 as unknown as DebtPayment["amount"],
    paidAt: new Date("2024-01-15"),
    staffId: 1,
    comment: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
});

describe("PublicDebtsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getMyDebtSummary", () => {
        test("should return debt summary for user", async () => {
            // Arrange
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ totalDebt: 30000, debtOrdersCount: 2 }])
                .mockResolvedValueOnce([{ totalPaid: 10000 }]);

            // Act
            const result = await PublicDebtsService.getMyDebtSummary(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                totalDebt: 30000,
                totalPaid: 10000,
                balance: 20000,
                debtOrdersCount: 2,
            });
        });

        test("should return zeros when user has no debts", async () => {
            // Arrange
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ totalDebt: 0, debtOrdersCount: 0 }])
                .mockResolvedValueOnce([{ totalPaid: 0 }]);

            // Act
            const result = await PublicDebtsService.getMyDebtSummary(999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.balance).toBe(0);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.$queryRaw.mockRejectedValue(new Error("Database error"));

            // Act
            const result = await PublicDebtsService.getMyDebtSummary(10, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getMyDebtPayments", () => {
        test("should return payments for user", async () => {
            // Arrange
            const mockPayments = [
                {
                    ...createMockDebtPayment({ id: 1 }),
                    staff: { id: 1, fullname: "Admin" },
                },
            ];
            prismaMock.debtPayment.findMany.mockResolvedValue(mockPayments as never);

            // Act
            const result = await PublicDebtsService.getMyDebtPayments(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.payments).toHaveLength(1);
        });

        test("should return empty list when no payments", async () => {
            // Arrange
            prismaMock.debtPayment.findMany.mockResolvedValue([]);

            // Act
            const result = await PublicDebtsService.getMyDebtPayments(999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.payments).toEqual([]);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.debtPayment.findMany.mockRejectedValue(new Error("Database error"));

            // Act
            const result = await PublicDebtsService.getMyDebtPayments(10, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
