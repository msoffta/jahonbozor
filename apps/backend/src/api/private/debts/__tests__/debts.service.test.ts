import { beforeEach, describe, expect, test } from "vitest";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { DebtsService } from "../debts.service";

import type { AuditLog, DebtPayment, Order } from "@backend/generated/prisma/client";
import type { Token } from "@jahonbozor/schemas";

const mockUser: Token = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    roleId: 1,
};

const mockContext = {
    staffId: 1,
    user: mockUser,
    requestId: "test-request-id",
};

const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 1,
    userId: 10,
    staffId: 1,
    paymentType: "DEBT",
    type: "ORDER",
    comment: null,
    data: {},
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

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

const createMockAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
    id: 1,
    requestId: "test-request-id",
    actorId: 1,
    actorType: "STAFF",
    entityType: "debt_payment",
    entityId: 1,
    action: "DEBT_PAYMENT",
    previousData: null,
    newData: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    ...overrides,
});

describe("DebtsService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getUserDebtSummary", () => {
        test("should return correct debt summary", async () => {
            // Arrange
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ totalDebt: 50000, debtOrdersCount: 3 }])
                .mockResolvedValueOnce([{ totalPaid: 20000 }]);

            // Act
            const result = await DebtsService.getUserDebtSummary(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                totalDebt: 50000,
                totalPaid: 20000,
                balance: 30000,
                debtOrdersCount: 3,
            });
        });

        test("should return zeros when user has no debts", async () => {
            // Arrange
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ totalDebt: 0, debtOrdersCount: 0 }])
                .mockResolvedValueOnce([{ totalPaid: 0 }]);

            // Act
            const result = await DebtsService.getUserDebtSummary(999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                totalDebt: 0,
                totalPaid: 0,
                balance: 0,
                debtOrdersCount: 0,
            });
        });

        test("should return negative balance when overpaid", async () => {
            // Arrange
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ totalDebt: 10000, debtOrdersCount: 1 }])
                .mockResolvedValueOnce([{ totalPaid: 15000 }]);

            // Act
            const result = await DebtsService.getUserDebtSummary(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.balance).toBe(-5000);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.$queryRaw.mockRejectedValue(new Error("Database error"));

            // Act
            const result = await DebtsService.getUserDebtSummary(10, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getDebtOrders", () => {
        test("should return debt orders with computed amounts", async () => {
            // Arrange
            const mockOrders = [
                {
                    ...createMockOrder({ id: 1 }),
                    items: [
                        {
                            id: 1,
                            orderId: 1,
                            productId: 1,
                            quantity: 2,
                            price: 10000,
                            data: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ],
                    debtPayments: [
                        {
                            ...createMockDebtPayment({
                                id: 1,
                                orderId: 1,
                                amount: 5000 as unknown as DebtPayment["amount"],
                            }),
                            staff: { id: 1, fullname: "Admin" },
                        },
                    ],
                },
            ];
            prismaMock.order.findMany.mockResolvedValue(mockOrders as never);

            // Act
            const result = await DebtsService.getDebtOrders(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.orders).toHaveLength(1);
            expect(success.data?.orders[0].orderTotal).toBe(20000);
            expect(success.data?.orders[0].paidAmount).toBe(5000);
            expect(success.data?.orders[0].remainingAmount).toBe(15000);
        });

        test("should return empty list when user has no debt orders", async () => {
            // Arrange
            prismaMock.order.findMany.mockResolvedValue([]);

            // Act
            const result = await DebtsService.getDebtOrders(999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.orders).toEqual([]);
        });

        test("should return order with zero paid when no payments", async () => {
            // Arrange
            const mockOrders = [
                {
                    ...createMockOrder({ id: 2 }),
                    items: [
                        {
                            id: 2,
                            orderId: 2,
                            productId: 1,
                            quantity: 1,
                            price: 30000,
                            data: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ],
                    debtPayments: [],
                },
            ];
            prismaMock.order.findMany.mockResolvedValue(mockOrders as never);

            // Act
            const result = await DebtsService.getDebtOrders(10, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.orders[0].paidAmount).toBe(0);
            expect(success.data?.orders[0].remainingAmount).toBe(30000);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.order.findMany.mockRejectedValue(new Error("Database error"));

            // Act
            const result = await DebtsService.getDebtOrders(10, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("createDebtPayment", () => {
        test("should create payment successfully", async () => {
            // Arrange
            const mockOrder = createMockOrder({ id: 1, userId: 10 });
            const mockOrderWithItems = {
                ...mockOrder,
                items: [{ price: 20000, quantity: 1 }],
                debtPayments: [],
            };
            prismaMock.order.findUnique
                .mockResolvedValueOnce(mockOrder)
                .mockResolvedValueOnce(mockOrderWithItems as never);

            const mockPayment = {
                ...createMockDebtPayment({ id: 5, orderId: 1, userId: 10 }),
                staff: { id: 1, fullname: "Admin" },
            };
            prismaMock.debtPayment.create.mockResolvedValue(mockPayment as never);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog());

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000, comment: "Partial payment" },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(5);
            expect(success.data?.amount).toBe(5000);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValue(null);

            // Act
            const result = await DebtsService.createDebtPayment(
                999,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return error when order is not DEBT type", async () => {
            // Arrange
            const cashOrder = createMockOrder({ id: 1, paymentType: "CASH" });
            prismaMock.order.findUnique.mockResolvedValue(cashOrder);

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order is not DEBT type");
        });

        test("should return error when order is deleted", async () => {
            // Arrange
            const deletedOrder = createMockOrder({ id: 1, deletedAt: new Date() });
            prismaMock.order.findUnique.mockResolvedValue(deletedOrder);

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Cannot pay for deleted order");
        });

        test("should return error when order has no user", async () => {
            // Arrange
            const noUserOrder = createMockOrder({ id: 1, userId: null });
            prismaMock.order.findUnique.mockResolvedValue(noUserOrder);

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order has no associated user");
        });

        test("should return error when payment exceeds remaining debt", async () => {
            // Arrange
            const mockOrder = createMockOrder({ id: 1, userId: 10 });
            const mockOrderWithItems = {
                ...mockOrder,
                items: [{ price: 10000, quantity: 1 }],
                debtPayments: [{ amount: 8000 }],
            };
            prismaMock.order.findUnique
                .mockResolvedValueOnce(mockOrder)
                .mockResolvedValueOnce(mockOrderWithItems as never);

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert — remaining is 2000, but trying to pay 5000
            const failure = expectFailure(result);
            expect(failure.error).toBe("Payment amount exceeds remaining debt");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should create payment with null comment when not provided", async () => {
            // Arrange
            const mockOrder = createMockOrder({ id: 1, userId: 10 });
            const mockOrderWithItems = {
                ...mockOrder,
                items: [{ price: 20000, quantity: 1 }],
                debtPayments: [],
            };
            prismaMock.order.findUnique
                .mockResolvedValueOnce(mockOrder)
                .mockResolvedValueOnce(mockOrderWithItems as never);

            const mockPayment = {
                ...createMockDebtPayment({ id: 6, comment: null }),
                staff: { id: 1, fullname: "Admin" },
            };
            prismaMock.debtPayment.create.mockResolvedValue(mockPayment as never);
            prismaMock.auditLog.create.mockResolvedValue(createMockAuditLog());

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 1000 },
                mockContext,
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.comment).toBeNull();
        });

        test("should handle database error during transaction", async () => {
            // Arrange
            const mockOrder = createMockOrder({ id: 1, userId: 10 });
            const mockOrderWithItems = {
                ...mockOrder,
                items: [{ price: 20000, quantity: 1 }],
                debtPayments: [],
            };
            prismaMock.order.findUnique
                .mockResolvedValueOnce(mockOrder)
                .mockResolvedValueOnce(mockOrderWithItems as never);
            prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

            // Act
            const result = await DebtsService.createDebtPayment(
                1,
                { amount: 5000 },
                mockContext,
                mockLogger,
            );

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getDebtPayments", () => {
        test("should return payments for order", async () => {
            // Arrange
            const mockPayments = [
                {
                    ...createMockDebtPayment({ id: 1 }),
                    staff: { id: 1, fullname: "Admin" },
                },
                {
                    ...createMockDebtPayment({
                        id: 2,
                        amount: 3000 as unknown as DebtPayment["amount"],
                    }),
                    staff: { id: 1, fullname: "Admin" },
                },
            ];
            prismaMock.debtPayment.findMany.mockResolvedValue(mockPayments as never);

            // Act
            const result = await DebtsService.getDebtPayments(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.payments).toHaveLength(2);
        });

        test("should return empty list when no payments", async () => {
            // Arrange
            prismaMock.debtPayment.findMany.mockResolvedValue([]);

            // Act
            const result = await DebtsService.getDebtPayments(999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.payments).toEqual([]);
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.debtPayment.findMany.mockRejectedValue(new Error("Database error"));

            // Act
            const result = await DebtsService.getDebtPayments(1, mockLogger);

            // Assert
            expectFailure(result);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
