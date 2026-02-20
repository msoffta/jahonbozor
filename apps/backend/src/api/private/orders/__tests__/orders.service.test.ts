import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import type { Order, OrderItem, Product, AuditLog, Prisma } from "@backend/generated/prisma/client";
import { type Token, Permission } from "@jahonbozor/schemas";
import { OrdersService } from "../orders.service";

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
    userId: null,
    staffId: 1,
    paymentType: "CASH",
    status: "NEW",
    data: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockOrderItem = {
    id: 1,
    orderId: 1,
    productId: 1,
    quantity: 2,
    price: 100 as unknown as Prisma.Decimal,
    data: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as OrderItem;

const mockOrderWithRelations = {
    ...mockOrder,
    items: [
        {
            ...mockOrderItem,
            product: { id: 1, name: "Test Product", price: 100 },
        },
    ],
    user: null,
    staff: { id: 1, fullname: "Test Staff" },
};

const mockTokenStaff: Token = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

const mockContext = {
    staffId: 1,
    user: mockTokenStaff,
    requestId: "req-123",
};

describe("Orders Service", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAllOrders", () => {
        test("should return paginated orders list", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([3, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "" },
                1,
                [Permission.ORDERS_LIST_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 3, orders: [mockOrderWithRelations] });
        });

        test("should filter by staffId when user lacks ORDERS_LIST_ALL permission", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "", staffId: 2 },
                1,
                [Permission.ORDERS_LIST_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.orders).toHaveLength(1);
        });

        test("should allow filtering by any staffId when user has ORDERS_LIST_ALL permission", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "", staffId: 2 },
                1,
                [Permission.ORDERS_LIST_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should apply paymentType filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "", paymentType: "CASH" },
                1,
                [Permission.ORDERS_LIST_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should apply status filter", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "", status: "NEW" },
                1,
                [Permission.ORDERS_LIST_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should apply date range filters", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithRelations]]);

            // Act
            const result = await OrdersService.getAllOrders(
                {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    dateFrom: new Date("2024-01-01"),
                    dateTo: new Date("2024-12-31"),
                },
                1,
                [Permission.ORDERS_LIST_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should return empty array when no orders found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValueOnce([0, []]);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "" },
                1,
                [Permission.ORDERS_LIST_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, orders: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await OrdersService.getAllOrders(
                { page: 1, limit: 20, searchQuery: "" },
                1,
                [Permission.ORDERS_LIST_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("getOrder", () => {
        test("should return order by id", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);

            // Act
            const result = await OrdersService.getOrder(
                1,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockOrderWithRelations);
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await OrdersService.getOrder(
                999,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found", { orderId: 999 });
        });

        test("should return Forbidden when staff lacks permission and not owner", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrderWithRelations, staffId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder as unknown as Order);

            // Act
            const result = await OrdersService.getOrder(
                1,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Forbidden");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Insufficient permissions to read order", {
                orderId: 1,
                staffId: 1,
                orderStaffId: 2,
            });
        });

        test("should allow reading any order when user has ORDERS_READ_ALL permission", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrderWithRelations, staffId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder as unknown as Order);

            // Act
            const result = await OrdersService.getOrder(
                1,
                1,
                [Permission.ORDERS_READ_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.order.findUnique.mockRejectedValueOnce(dbError);

            // Act
            const result = await OrdersService.getOrder(
                1,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
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
            const result = await OrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.id).toBe(1);
            expect(mockLogger.info).toHaveBeenCalledWith("Orders: Order created", {
                orderId: 1,
                staffId: 1,
                itemCount: 1,
            });
        });

        test("should return error when products not found", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await OrdersService.createOrder(validOrderData, mockContext, mockLogger);

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
            const result = await OrdersService.createOrder(orderWithHighQuantity, mockContext, mockLogger);

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
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Insufficient stock", expect.any(Object));
        });

        test("should create ProductHistory records", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.createOrder(validOrderData, mockContext, mockLogger);

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
            await OrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await OrdersService.createOrder(validOrderData, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("updateOrder", () => {
        test("should update order status", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, status: "ACCEPTED" };
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.status).toBe("ACCEPTED");
            expect(mockLogger.info).toHaveBeenCalledWith("Orders: Order updated", { orderId: 1, staffId: 1 });
        });

        test("should update paymentType", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, paymentType: "CREDIT_CARD" };
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.paymentType).toBe("CREDIT_CARD");
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await OrdersService.updateOrder(
                999,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found for update", { orderId: 999 });
        });

        test("should return Forbidden when staff lacks permission and not owner", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrder, staffId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Forbidden");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Insufficient permissions to update order", {
                orderId: 1,
                staffId: 1,
                orderStaffId: 2,
            });
        });

        test("should allow updating any order when user has ORDERS_UPDATE_ALL permission", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrder, staffId: 2 };
            const updatedOrder = { ...mockOrderWithRelations, staffId: 2, status: "ACCEPTED" };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
        });

        test("should use ORDER_STATUS_CHANGE action when status changes", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, status: "ACCEPTED" };
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.updateOrder(
                1,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("should create AuditLog entry", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, paymentType: "CREDIT_CARD" };
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.updateOrder(
                1,
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { status: "ACCEPTED" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("deleteOrder", () => {
        const mockOrderWithItems = {
            ...mockOrder,
            items: [
                {
                    ...mockOrderItem,
                    product: { id: 1, remaining: 10, deletedAt: null },
                },
            ],
        };

        test("should delete order and restore stock", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithItems as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.order.delete.mockResolvedValueOnce(mockOrder);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.deleteOrder(1, mockContext, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ orderId: 1, deleted: true });
            expect(mockLogger.info).toHaveBeenCalledWith("Orders: Order deleted and stock restored", {
                orderId: 1,
                itemsRestored: 1,
                staffId: 1,
            });
        });

        test("should create ProductHistory for stock restoration", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithItems as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.order.delete.mockResolvedValueOnce(mockOrder);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.deleteOrder(1, mockContext, mockLogger);

            // Assert
            expect(prismaMock.productHistory.create).toHaveBeenCalled();
        });

        test("should not restore stock for deleted products", async () => {
            // Arrange
            const orderWithDeletedProduct = {
                ...mockOrder,
                items: [
                    {
                        ...mockOrderItem,
                        product: { id: 1, remaining: 10, deletedAt: new Date() },
                    },
                ],
            };
            prismaMock.order.findUnique.mockResolvedValueOnce(orderWithDeletedProduct as unknown as Order);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.order.delete.mockResolvedValueOnce(mockOrder);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.deleteOrder(1, mockContext, mockLogger);

            // Assert
            expect(prismaMock.product.update).not.toHaveBeenCalled();
        });

        test("should return error when order not found", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            // Act
            const result = await OrdersService.deleteOrder(999, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found for delete", { orderId: 999 });
        });

        test("should create AuditLog entry", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithItems as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.order.delete.mockResolvedValueOnce(mockOrder);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.deleteOrder(1, mockContext, mockLogger);

            // Assert
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        test("should handle database error", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrderWithItems as unknown as Order);
            const dbError = new Error("Database error");
            prismaMock.$transaction.mockRejectedValueOnce(dbError);

            // Act
            const result = await OrdersService.deleteOrder(1, mockContext, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe("edge cases", () => {
        test("getOrder with id=0 should return not found", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            const result = await OrdersService.getOrder(0, 1, [Permission.ORDERS_READ_OWN], mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });

        test("getOrder with negative id should return not found", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            const result = await OrdersService.getOrder(-1, 1, [Permission.ORDERS_READ_OWN], mockLogger);

            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });

        test("createOrder with deleted product should return error", async () => {
            // DB query has deletedAt: null filter, so deleted products are not returned
            prismaMock.product.findMany.mockResolvedValueOnce([]);

            const result = await OrdersService.createOrder(
                { paymentType: "CASH", items: [{ productId: 1, quantity: 1, price: 100 }] },
                mockContext,
                mockLogger,
            );

            const failure = expectFailure(result);
            expect(failure.error).toBe("Products not found: 1");
        });

        test("createOrder with multiple items, one missing product", async () => {
            // Only product 1 exists, product 2 does not
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);

            const result = await OrdersService.createOrder(
                {
                    paymentType: "CASH",
                    items: [
                        { productId: 1, quantity: 1, price: 100 },
                        { productId: 2, quantity: 1, price: 200 },
                    ],
                },
                mockContext,
                mockLogger,
            );

            const failure = expectFailure(result);
            expect(failure.error).toContain("2");
        });

        test("createOrder with exact stock quantity should succeed", async () => {
            const exactStockProduct = { ...mockProduct, remaining: 5 };
            prismaMock.product.findMany.mockResolvedValueOnce([exactStockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            const result = await OrdersService.createOrder(
                { paymentType: "CASH", items: [{ productId: 1, quantity: 5, price: 100 }] },
                mockContext,
                mockLogger,
            );

            expectSuccess(result);
        });

        test("updateOrder with empty body should succeed", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(mockOrder);
            prismaMock.order.update.mockResolvedValueOnce(mockOrderWithRelations as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            const result = await OrdersService.updateOrder(
                1,
                {},
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            expectSuccess(result);
        });

        test("deleteOrder with no items should succeed", async () => {
            const orderNoItems = { ...mockOrder, items: [] };
            prismaMock.order.findUnique.mockResolvedValueOnce(orderNoItems as unknown as Order);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 0 });
            prismaMock.order.delete.mockResolvedValueOnce(mockOrder);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            const result = await OrdersService.deleteOrder(1, mockContext, mockLogger);

            const success = expectSuccess(result);
            expect(success.data).toEqual({ orderId: 1, deleted: true });
        });
    });
});
