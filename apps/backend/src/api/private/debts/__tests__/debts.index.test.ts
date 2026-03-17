import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger } from "@backend/test/setup";

import { DebtsService } from "../debts.service";

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: [
                Permission.DEBTS_LIST,
                Permission.DEBTS_READ,
                Permission.DEBTS_CREATE_PAYMENT,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/debts/users/:userId/summary", async ({ params, logger }) => {
            return await DebtsService.getUserDebtSummary(Number(params.userId), logger);
        })
        .get("/debts/users/:userId/orders", async ({ params, logger }) => {
            return await DebtsService.getDebtOrders(Number(params.userId), logger);
        })
        .post("/debts/orders/:orderId/payments", async ({ params, body, logger, requestId }) => {
            const paymentData = body as { amount: number; comment?: string | null };
            return await DebtsService.createDebtPayment(
                Number(params.orderId),
                paymentData,
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        })
        .get("/debts/orders/:orderId/payments", async ({ params, logger }) => {
            return await DebtsService.getDebtPayments(Number(params.orderId), logger);
        });
};

describe("Debts API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /debts/users/:userId/summary", () => {
        test("should return debt summary for user", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getUserDebtSummary").mockResolvedValue({
                success: true,
                data: { totalDebt: 50000, totalPaid: 20000, balance: 30000, debtOrdersCount: 3 },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/users/10/summary"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.balance).toBe(30000);
            expect(spy).toHaveBeenCalledWith(10, expect.anything());

            spy.mockRestore();
        });

        test("should handle service error", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getUserDebtSummary").mockResolvedValue({
                success: false,
                error: "Database error",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/users/10/summary"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);

            spy.mockRestore();
        });
    });

    describe("GET /debts/users/:userId/orders", () => {
        test("should return debt orders for user", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getDebtOrders").mockResolvedValue({
                success: true,
                data: {
                    orders: [
                        {
                            orderId: 1,
                            userId: 10,
                            orderTotal: 20000,
                            paidAmount: 5000,
                            remainingAmount: 15000,
                            status: "ACCEPTED",
                            createdAt: new Date(),
                            payments: [],
                        },
                    ],
                },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/users/10/orders"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.orders).toHaveLength(1);
            expect(spy).toHaveBeenCalledWith(10, expect.anything());

            spy.mockRestore();
        });

        test("should return empty list for user with no debts", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getDebtOrders").mockResolvedValue({
                success: true,
                data: { orders: [] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/users/999/orders"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(true);
            expect(body.data.orders).toEqual([]);

            spy.mockRestore();
        });
    });

    describe("POST /debts/orders/:orderId/payments", () => {
        test("should create payment successfully", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "createDebtPayment").mockResolvedValue({
                success: true,
                data: {
                    id: 1,
                    orderId: 1,
                    userId: 10,
                    amount: 5000,
                    paidAt: new Date(),
                    staffId: 1,
                    comment: "Partial payment",
                    staff: { id: 1, fullname: "Admin" },
                    createdAt: new Date(),
                },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/orders/1/payments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: 5000, comment: "Partial payment" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.amount).toBe(5000);
            expect(spy).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ amount: 5000 }),
                expect.objectContaining({ staffId: 1 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "createDebtPayment").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/orders/999/payments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: 5000 }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Order not found");

            spy.mockRestore();
        });
    });

    describe("GET /debts/orders/:orderId/payments", () => {
        test("should return payments for order", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getDebtPayments").mockResolvedValue({
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
            const response = await app.handle(
                new Request("http://localhost/debts/orders/1/payments"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.payments).toHaveLength(1);
            expect(spy).toHaveBeenCalledWith(1, expect.anything());

            spy.mockRestore();
        });

        test("should return empty payments list", async () => {
            // Arrange
            const spy = vi.spyOn(DebtsService, "getDebtPayments").mockResolvedValue({
                success: true,
                data: { payments: [] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/debts/orders/999/payments"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(true);
            expect(body.data.payments).toEqual([]);

            spy.mockRestore();
        });
    });
});
