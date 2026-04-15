import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger } from "@backend/test/setup";

import { PublicDebtsService } from "../debts.service";

const mockUserToken = {
    id: 10,
    type: "user" as const,
    fullname: "Test User",
    phone: "+998901234567",
    telegramId: "123456",
};

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUserToken,
            type: "user" as const,
            logger: mockLogger,
        }))
        .get("/debts/summary", async ({ user, logger }) => {
            return await PublicDebtsService.getMyDebtSummary(user.id, logger);
        })
        .get("/debts/payments", async ({ user, logger }) => {
            return await PublicDebtsService.getMyDebtPayments(user.id, logger);
        });
};

describe("Public Debts API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /debts/summary", () => {
        test("should return debt summary for authenticated user", async () => {
            // Arrange
            const spy = vi.spyOn(PublicDebtsService, "getMyDebtSummary").mockResolvedValue({
                success: true,
                data: { totalDebt: 30000, totalPaid: 10000, balance: 20000, debtOrdersCount: 2 },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/debts/summary"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.balance).toBe(20000);
            expect(spy).toHaveBeenCalledWith(10, expect.anything());

            spy.mockRestore();
        });
    });

    describe("GET /debts/payments", () => {
        test("should return payments for authenticated user", async () => {
            // Arrange
            const spy = vi.spyOn(PublicDebtsService, "getMyDebtPayments").mockResolvedValue({
                success: true,
                data: {
                    payments: [
                        {
                            id: 1,
                            orderId: 1,
                            userId: 10,
                            amount: 5000,
                            paidAt: new Date(),
                            staffId: 1,
                            comment: null,
                            staff: { id: 1, fullname: "Admin" },
                            createdAt: new Date(),
                        },
                    ],
                },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/debts/payments"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.payments).toHaveLength(1);
            expect(spy).toHaveBeenCalledWith(10, expect.anything());

            spy.mockRestore();
        });

        test("should return empty list when no payments", async () => {
            // Arrange
            const spy = vi.spyOn(PublicDebtsService, "getMyDebtPayments").mockResolvedValue({
                success: true,
                data: { payments: [] },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/debts/payments"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(true);
            expect(body.data.payments).toEqual([]);

            spy.mockRestore();
        });
    });
});
