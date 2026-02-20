import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import type { Order, Product, AuditLog, Prisma } from "@backend/generated/prisma/client";
import type { Token } from "@jahonbozor/schemas";
import { PublicOrdersService } from "../orders.service";

const mockProduct = {
    id: 1,
    name: "Test Product",
    price: 100,
    costprice: 80,
    remaining: 10,
    categoryId: 1,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as unknown as Product;

const mockOrder: Order = {
    id: 1,
    userId: 1,
    staffId: null,
    paymentType: "CASH",
    status: "NEW",
    data: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockOrderWithRelations = {
    ...mockOrder,
    items: [
        {
            id: 1,
            orderId: 1,
            productId: 1,
            quantity: 2,
            price: 100,
            data: null,
            product: { id: 1, name: "Test Product", price: 100 },
        },
    ],
};

const mockTokenUser: Token = {
    id: 1,
    type: "user" as const,
    fullname: "Test User",
    username: "testuser",
    phone: "998901234567",
    telegramId: "123456789",
};

const mockContext = {
    userId: 1,
    user: mockTokenUser,
    requestId: "req-123",
};

describe("PublicOrders Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("createOrder", () => {
        const validOrderData = {
            paymentType: "CASH" as const,
            items: [
                { productId: 1, quantity: 2, price: 100 },
            ],
        };

        test("should create order with valid data", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await PublicOrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(1);
            expect(mockLogger.info).toHaveBeenCalledWith("PublicOrders: Order created", {
                orderId: 1,
                userId: 1,
                itemCount: 1,
            });
        });

        test("should return error when products not found", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await PublicOrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Products not found: 1");
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test("should return error on insufficient stock", async () => {
            // Arrange
            const lowStockProduct = { ...mockProduct, remaining: 1 };
            prismaMock.product.findMany.mockResolvedValueOnce([lowStockProduct]);

            // Act
            const orderWithHighQuantity = {
                ...validOrderData,
                items: [{ productId: 1, quantity: 10, price: 100 }],
            };
            const result = await PublicOrdersService.createOrder(orderWithHighQuantity, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toEqual({
                code: "INSUFFICIENT_STOCK",
                message: "One or more products have insufficient stock",
                details: [
                    {
                        productId: 1,
                        productName: "Test Product",
                        requested: 10,
                        available: 1,
                    },
                ],
            });
        });

        test("should create ProductHistory records", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await PublicOrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            expect(prismaMock.productHistory.create).toHaveBeenCalled();
        });

        test("should create AuditLog entry", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await PublicOrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await PublicOrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getUserOrders", () => {
        test("should return user's paginated orders", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([3, [mockOrderWithRelations]]);

            // Act
            const result = await PublicOrdersService.getUserOrders(
                1,
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 3, orders: [mockOrderWithRelations] });
        });

        test("should apply filters", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await PublicOrdersService.getUserOrders(
                1,
                { page: 1, limit: 20, searchQuery: "", paymentType: "CASH", status: "NEW" },
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should return empty array when no orders found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await PublicOrdersService.getUserOrders(
                1,
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, orders: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await PublicOrdersService.getUserOrders(
                1,
                { page: 1, limit: 20, searchQuery: "" },
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getUserOrder", () => {
        test("should return user's order by id", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);

            // Act
            const result = await PublicOrdersService.getUserOrder(1, 1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockOrderWithRelations);
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await PublicOrdersService.getUserOrder(999, 1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("PublicOrders: Order not found", {
                orderId: 999,
                userId: 1,
            });
        });

        test("should return Forbidden when order belongs to another user", async () => {
            // Arrange
            const otherUserOrder = { ...mockOrderWithRelations, userId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherUserOrder as unknown as Order);

            // Act
            const result = await PublicOrdersService.getUserOrder(1, 1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Forbidden");
            expect(mockLogger.warn).toHaveBeenCalledWith("PublicOrders: User not authorized to view order", {
                orderId: 1,
                userId: 1,
                orderUserId: 2,
            });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.order.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await PublicOrdersService.getUserOrder(1, 1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("cancelOrder", () => {
        const mockOrderWithProducts = {
            ...mockOrder,
            items: [
                {
                    id: 1,
                    orderId: 1,
                    productId: 1,
                    quantity: 2,
                    price: 100,
                    data: null,
                    product: { id: 1, remaining: 8, deletedAt: null },
                },
            ],
        };

        const mockCancelledOrder = {
            ...mockOrder,
            status: "CANCELLED",
            items: [
                {
                    id: 1,
                    orderId: 1,
                    productId: 1,
                    quantity: 2,
                    price: 100,
                    data: null,
                    product: { id: 1, name: "Test Product", price: 100 },
                },
            ],
        };

        test("should cancel NEW order and restore inventory", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithProducts as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.order.update.mockResolvedValueOnce(mockCancelledOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.status).toBe("CANCELLED");
            expect(mockLogger.info).toHaveBeenCalledWith("PublicOrders: Order cancelled and stock restored", {
                orderId: 1,
                userId: 1,
                itemsRestored: 1,
            });
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await PublicOrdersService.cancelOrder(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });

        test("should return Forbidden when order belongs to another user", async () => {
            // Arrange
            const otherUserOrder = { ...mockOrderWithProducts, userId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherUserOrder as unknown as Order);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Forbidden");
        });

        test("should return error when order status is not NEW", async () => {
            // Arrange
            const acceptedOrder = { ...mockOrderWithProducts, status: "ACCEPTED" };
            prismaMock.order.findUnique.mockResolvedValueOnce(acceptedOrder as unknown as Order);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Only NEW orders can be cancelled");
        });

        test("should not restore inventory for deleted products", async () => {
            // Arrange
            const orderWithDeletedProduct = {
                ...mockOrder,
                items: [
                    {
                        id: 1,
                        orderId: 1,
                        productId: 1,
                        quantity: 2,
                        price: 100,
                        data: null,
                        product: { id: 1, remaining: 8, deletedAt: new Date("2024-06-01") },
                    },
                ],
            };
            prismaMock.order.findUnique.mockResolvedValueOnce(orderWithDeletedProduct as unknown as Order);
            prismaMock.order.update.mockResolvedValueOnce(mockCancelledOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            expectSuccess(result);
            expect(prismaMock.product.update).not.toHaveBeenCalled();
            expect(prismaMock.productHistory.create).not.toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.order.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        test("should return error when cancelling already cancelled order", async () => {
            // Arrange
            const cancelledOrder = { ...mockOrderWithProducts, status: "CANCELLED" };
            prismaMock.order.findUnique.mockResolvedValueOnce(cancelledOrder as unknown as Order);

            // Act
            const result = await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Only NEW orders can be cancelled");
        });

        test("should create audit log with ORDER_STATUS_CHANGE action", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithProducts as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.order.update.mockResolvedValueOnce(mockCancelledOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await PublicOrdersService.cancelOrder(1, mockContext, mockLogger);

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("cancelOrder with id=0 should return not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await PublicOrdersService.cancelOrder(0, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });
    });

    describe("edge cases", () => {
        test("createOrder with deleted product should return not found", async () => {
            // DB query has deletedAt: null filter, so deleted products are not returned
            prismaMock.product.findMany.mockResolvedValueOnce([]);

            const result = await PublicOrdersService.createOrder(
                { paymentType: "CASH", items: [{ productId: 1, quantity: 1, price: 100 }] },
                mockContext,
                mockLogger,
            );

            const failure = expectFailure(result);
            expect(failure.error).toBe("Products not found: 1");
        });

        test("createOrder with exact stock should succeed", async () => {
            const exactStockProduct = { ...mockProduct, remaining: 2 };
            prismaMock.product.findMany.mockResolvedValueOnce([exactStockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            const result = await PublicOrdersService.createOrder(
                { paymentType: "CASH", items: [{ productId: 1, quantity: 2, price: 100 }] },
                mockContext,
                mockLogger,
            );

            expectSuccess(result);
        });

        test("getUserOrder with id=0 should return not found", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            const result = await PublicOrdersService.getUserOrder(0, 1, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });

        test("getUserOrder with negative id should return not found", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            const result = await PublicOrdersService.getUserOrder(-1, 1, mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });
    });
});
