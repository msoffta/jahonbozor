import { beforeEach, describe, expect, test } from "vitest";

import { Permission, type Token } from "@jahonbozor/schemas";

import { createMockLogger, expectFailure, expectSuccess, prismaMock } from "@backend/test/setup";

import { OrdersService } from "../orders.service";

import type { AuditLog, Order, OrderItem, Prisma, Product } from "@backend/generated/prisma/client";

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
    comment: null,
    data: {},
    deletedAt: null,
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
            product: { id: 1, name: "Test Product", price: 100, costprice: 80, remaining: 10 },
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
                { page: 1, limit: 20, sortBy: "id", sortOrder: "asc" as const, searchQuery: "" },
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
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    staffId: 2,
                },
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
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    staffId: 2,
                },
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
                {
                    page: 1,
                    limit: 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    paymentType: "CASH",
                },
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
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    dateFrom: "2024-01-01T00:00:00.000Z",
                    dateTo: "2024-12-31T00:00:00.000Z",
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
                { page: 1, limit: 20, sortBy: "id", sortOrder: "asc" as const, searchQuery: "" },
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
                { page: 1, limit: 20, sortBy: "id", sortOrder: "asc" as const, searchQuery: "" },
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
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );

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
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found", {
                orderId: 999,
            });
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
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Orders: Insufficient permissions to read order",
                {
                    orderId: 1,
                    staffId: 1,
                    orderStaffId: 2,
                },
            );
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
            items: [{ productId: 1, quantity: 2, price: 100 }],
        };

        test("should create order with valid data", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
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

        test("should succeed when items contain duplicate productIds", async () => {
            // Arrange — duplicate productId=1 in items
            const orderWithDuplicates = {
                paymentType: "CASH" as const,
                items: [
                    { productId: 1, quantity: 1, price: 100 },
                    { productId: 1, quantity: 2, price: 100 },
                ],
            };
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.createOrder(
                orderWithDuplicates,
                mockContext,
                mockLogger,
            );

            // Assert — deduplication means product is found, so no "Products not found" error
            expect(result.success).toBe(true);
        });

        test("should create ProductHistory records", async () => {
            // Arrange
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
            prismaMock.order.create.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
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
            prismaMock.order.create.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
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
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found for update", {
                orderId: 999,
            });
        });

        test("should return Forbidden when staff lacks permission and not owner", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrder, staffId: 2 };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Forbidden");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Orders: Insufficient permissions to update order",
                {
                    orderId: 1,
                    staffId: 1,
                    orderStaffId: 2,
                },
            );
        });

        test("should allow updating any order when user has ORDERS_UPDATE_ALL permission", async () => {
            // Arrange
            const otherStaffOrder = { ...mockOrder, staffId: 2 };
            const updatedOrder = {
                ...mockOrderWithRelations,
                staffId: 2,
                paymentType: "CREDIT_CARD",
            };
            prismaMock.order.findUnique.mockResolvedValueOnce(otherStaffOrder);
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_ALL],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
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
                { paymentType: "CREDIT_CARD" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        // --- Items update tests ---

        const mockOrderWithItemsForUpdate = {
            ...mockOrder,
            items: [
                {
                    ...mockOrderItem,
                    product: { id: 1, remaining: 10, deletedAt: null },
                },
            ],
        };

        const mockProduct2 = {
            ...mockProduct,
            id: 2,
            name: "Product 2",
            remaining: 20,
        };

        const mockUpdatedOrderWithNewItems = {
            ...mockOrder,
            items: [
                {
                    ...mockOrderItem,
                    productId: 2,
                    quantity: 3,
                    price: 100 as unknown as Prisma.Decimal,
                    product: { id: 2, name: "Product 2", price: 100, costprice: 80, remaining: 17 },
                },
            ],
            user: null,
            staff: { id: 1, fullname: "Test Staff" },
        };

        function setupItemsUpdateMocks(
            existingOrder = mockOrderWithItemsForUpdate,
            newProducts = [mockProduct2],
            updatedOrder = mockUpdatedOrderWithNewItems,
        ) {
            prismaMock.order.findUnique.mockResolvedValueOnce(existingOrder as unknown as Order);
            prismaMock.product.findMany.mockResolvedValueOnce(newProducts as unknown as Product[]);
            // In transaction: restore old stock
            prismaMock.product.update.mockResolvedValueOnce(mockProduct);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            // Delete old items
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            // Create new items + deduct stock
            prismaMock.orderItem.create.mockResolvedValueOnce({} as never);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct2 as unknown as Product);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            // Update order
            prismaMock.order.update.mockResolvedValueOnce(updatedOrder as unknown as Order);
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);
        }

        test("should update order items with valid data", async () => {
            // Arrange
            setupItemsUpdateMocks();

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { items: [{ productId: 2, quantity: 3, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toBeDefined();
            expect(prismaMock.orderItem.deleteMany).toHaveBeenCalledWith({
                where: { orderId: 1 },
            });
            expect(prismaMock.orderItem.create).toHaveBeenCalled();
        });

        test("should restore old stock and deduct new stock when updating items", async () => {
            // Arrange
            setupItemsUpdateMocks();

            // Act
            await OrdersService.updateOrder(
                1,
                { items: [{ productId: 2, quantity: 3, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — product.update called twice: restore old (increment) + deduct new (decrement)
            expect(prismaMock.product.update).toHaveBeenCalledTimes(2);
            // First call: restore old stock (increment)
            expect(prismaMock.product.update).toHaveBeenNthCalledWith(1, {
                where: { id: 1 },
                data: { remaining: { increment: 2 } },
            });
            // Second call: deduct new stock (decrement)
            expect(prismaMock.product.update).toHaveBeenNthCalledWith(2, {
                where: { id: 2 },
                data: { remaining: { decrement: 3 } },
            });
        });

        test("should create ProductHistory for both restore and deduct", async () => {
            // Arrange
            setupItemsUpdateMocks();

            // Act
            await OrdersService.updateOrder(
                1,
                { items: [{ productId: 2, quantity: 3, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — productHistory.create called twice
            expect(prismaMock.productHistory.create).toHaveBeenCalledTimes(2);
            // First: INVENTORY_ADD (restore)
            expect(prismaMock.productHistory.create).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    data: expect.objectContaining({
                        operation: "INVENTORY_ADD",
                        productId: 1,
                        quantity: 2,
                    }),
                }),
            );
            // Second: INVENTORY_REMOVE (deduct)
            expect(prismaMock.productHistory.create).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    data: expect.objectContaining({
                        operation: "INVENTORY_REMOVE",
                        productId: 2,
                        quantity: 3,
                    }),
                }),
            );
        });

        test("should return error when new items reference non-existent products", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItemsForUpdate as unknown as Order,
            );
            prismaMock.product.findMany.mockResolvedValueOnce([]);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { items: [{ productId: 999, quantity: 1, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toContain("Products not found");
        });

        test("should not return empty 'Products not found' error with duplicate productIds in items", async () => {
            // Regression test: duplicate productIds caused findMany to return fewer rows than
            // productIds.length, triggering a false "Products not found: " (empty) error.
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItemsForUpdate as unknown as Order,
            );
            // findMany returns 1 unique product for the 2 duplicate productId=2 items
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct2 as unknown as Product]);

            // Act — two items with same productId=2
            const result = await OrdersService.updateOrder(
                1,
                {
                    items: [
                        { productId: 2, quantity: 1, price: 100 },
                        { productId: 2, quantity: 2, price: 100 },
                    ],
                },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — must NOT be the misleading empty error
            if (!result.success) {
                expect((result as { success: false; error: string }).error).not.toBe(
                    "Products not found: ",
                );
            }
        });

        test("should succeed when stock is sufficient after old stock restoration", async () => {
            // Arrange — old order has 5 of product1 (remaining=0), new order wants 3 of same product
            const orderWithHighQty = {
                ...mockOrder,
                items: [
                    {
                        ...mockOrderItem,
                        quantity: 5,
                        product: { id: 1, remaining: 0, deletedAt: null },
                    },
                ],
            };
            // Product1 has remaining=0, but old stock (5) is restored → effective=5 >= 3
            const product1WithZeroStock = { ...mockProduct, remaining: 0 };
            prismaMock.order.findUnique.mockResolvedValueOnce(orderWithHighQty as unknown as Order);
            prismaMock.product.findMany.mockResolvedValueOnce([
                product1WithZeroStock as unknown as Product,
            ]);
            // Transaction mocks
            prismaMock.product.update.mockResolvedValueOnce(mockProduct); // restore
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.orderItem.create.mockResolvedValueOnce({} as never);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct); // deduct
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.order.update.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { items: [{ productId: 1, quantity: 3, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — should succeed because effective remaining (0+5=5) >= 3
            expectSuccess(result);
        });

        test("should not restore stock for deleted products when replacing items", async () => {
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
            prismaMock.order.findUnique.mockResolvedValueOnce(
                orderWithDeletedProduct as unknown as Order,
            );
            prismaMock.product.findMany.mockResolvedValueOnce([mockProduct2 as unknown as Product]);
            // No restore calls — skip to delete + create
            prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
            prismaMock.orderItem.create.mockResolvedValueOnce({} as never);
            prismaMock.product.update.mockResolvedValueOnce(mockProduct2 as unknown as Product);
            prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
            prismaMock.order.update.mockResolvedValueOnce(
                mockUpdatedOrderWithNewItems as unknown as Order,
            );
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            await OrdersService.updateOrder(
                1,
                { items: [{ productId: 2, quantity: 3, price: 100 }] },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — product.update called only once (deduct new), not for restore
            expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
            expect(prismaMock.productHistory.create).toHaveBeenCalledTimes(1);
        });

        test("should leave items unchanged when items field is omitted", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItemsForUpdate as unknown as Order,
            );
            prismaMock.order.update.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
            prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

            // Act
            const result = await OrdersService.updateOrder(
                1,
                { comment: "updated comment" },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert — no item operations
            expectSuccess(result);
            expect(prismaMock.orderItem.deleteMany).not.toHaveBeenCalled();
            expect(prismaMock.orderItem.create).not.toHaveBeenCalled();
            expect(prismaMock.product.findMany).not.toHaveBeenCalled();
        });

        test("should update comment and items simultaneously", async () => {
            // Arrange
            setupItemsUpdateMocks();

            // Act
            const result = await OrdersService.updateOrder(
                1,
                {
                    comment: "new comment",
                    items: [{ productId: 2, quantity: 3, price: 100 }],
                },
                mockContext,
                [Permission.ORDERS_UPDATE_OWN],
                mockLogger,
            );

            // Assert
            expectSuccess(result);
            expect(prismaMock.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ comment: "new comment" }),
                }),
            );
            expect(prismaMock.orderItem.deleteMany).toHaveBeenCalled();
            expect(prismaMock.orderItem.create).toHaveBeenCalled();
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
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItems as unknown as Order,
            );
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
            expect(mockLogger.info).toHaveBeenCalledWith(
                "Orders: Order deleted and stock restored",
                {
                    orderId: 1,
                    itemsRestored: 1,
                    staffId: 1,
                },
            );
        });

        test("should create ProductHistory for stock restoration", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItems as unknown as Order,
            );
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
            prismaMock.order.findUnique.mockResolvedValueOnce(
                orderWithDeletedProduct as unknown as Order,
            );
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
            expect(mockLogger.warn).toHaveBeenCalledWith("Orders: Order not found for delete", {
                orderId: 999,
            });
        });

        test("should create AuditLog entry", async () => {
            // Arrange
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItems as unknown as Order,
            );
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
            prismaMock.order.findUnique.mockResolvedValueOnce(
                mockOrderWithItems as unknown as Order,
            );
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

            const result = await OrdersService.getOrder(
                0,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

            const failure = expectFailure(result);
            expect(failure.error).toBe("Order not found");
        });

        test("getOrder with negative id should return not found", async () => {
            prismaMock.order.findUnique.mockResolvedValueOnce(null);

            const result = await OrdersService.getOrder(
                -1,
                1,
                [Permission.ORDERS_READ_OWN],
                mockLogger,
            );

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
            prismaMock.order.create.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
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
            prismaMock.order.update.mockResolvedValueOnce(
                mockOrderWithRelations as unknown as Order,
            );
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

    describe("null-product items (productId = null)", () => {
        const mockOrderItemNullProduct = {
            ...mockOrderItem,
            productId: null,
            product: null,
        };

        const mockOrderWithNullProductItem = {
            ...mockOrder,
            items: [
                {
                    ...mockOrderItemNullProduct,
                    price: 150 as unknown as Prisma.Decimal,
                },
            ],
            user: null,
            staff: { id: 1, fullname: "Test Staff" },
        };

        describe("createOrder", () => {
            test("should create order with null-product item (no stock deduction)", async () => {
                // Arrange — no product lookup needed
                prismaMock.order.create.mockResolvedValueOnce(
                    mockOrderWithNullProductItem as unknown as Order,
                );
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.createOrder(
                    { paymentType: "CASH", items: [{ productId: null, quantity: 3, price: 150 }] },
                    mockContext,
                    mockLogger,
                );

                // Assert
                expectSuccess(result);
                // No product.findMany needed (no items with productId)
                expect(prismaMock.product.findMany).not.toHaveBeenCalled();
                // No stock deduction
                expect(prismaMock.product.update).not.toHaveBeenCalled();
                expect(prismaMock.productHistory.create).not.toHaveBeenCalled();
            });

            test("should create order with mixed items (product + null-product)", async () => {
                // Arrange
                const mixedOrderResponse = {
                    ...mockOrder,
                    items: [
                        {
                            ...mockOrderItem,
                            product: {
                                id: 1,
                                name: "Test Product",
                                price: 100,
                                costprice: 80,
                                remaining: 8,
                            },
                        },
                        {
                            ...mockOrderItemNullProduct,
                            id: 2,
                            price: 200 as unknown as Prisma.Decimal,
                        },
                    ],
                    user: null,
                    staff: { id: 1, fullname: "Test Staff" },
                };

                prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
                prismaMock.order.create.mockResolvedValueOnce(
                    mixedOrderResponse as unknown as Order,
                );
                prismaMock.product.update.mockResolvedValueOnce(mockProduct);
                prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.createOrder(
                    {
                        paymentType: "CASH",
                        items: [
                            { productId: 1, quantity: 2, price: 100 },
                            { productId: null, quantity: 5, price: 200 },
                        ],
                    },
                    mockContext,
                    mockLogger,
                );

                // Assert
                expectSuccess(result);
                // product.findMany called for the one item with productId
                expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
                // Stock deducted only for product item, not for null-product item
                expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
                expect(prismaMock.product.update).toHaveBeenCalledWith({
                    where: { id: 1 },
                    data: { remaining: { decrement: 2 } },
                });
            });

            test("should not merge items with null productId", async () => {
                // Arrange — two null-product items should stay separate
                const twoNullItems = {
                    ...mockOrder,
                    items: [
                        { ...mockOrderItemNullProduct, id: 1 },
                        { ...mockOrderItemNullProduct, id: 2 },
                    ],
                    user: null,
                    staff: { id: 1, fullname: "Test Staff" },
                };

                prismaMock.order.create.mockResolvedValueOnce(twoNullItems as unknown as Order);
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.createOrder(
                    {
                        paymentType: "CASH",
                        items: [
                            { productId: null, quantity: 1, price: 100 },
                            { productId: null, quantity: 2, price: 200 },
                        ],
                    },
                    mockContext,
                    mockLogger,
                );

                // Assert — both items created (not merged)
                expectSuccess(result);
                const createCall = prismaMock.order.create.mock.calls[0][0];
                const createdItems = (createCall as { data: { items: { create: unknown[] } } }).data
                    .items.create;
                expect(createdItems).toHaveLength(2);
            });
        });

        describe("getAllOrders / getOrder", () => {
            test("getAllOrders should return null product in response mapping", async () => {
                // Arrange
                prismaMock.$transaction.mockResolvedValueOnce([1, [mockOrderWithNullProductItem]]);

                // Act
                const result = await OrdersService.getAllOrders(
                    {
                        page: 1,
                        limit: 20,
                        sortBy: "id",
                        sortOrder: "asc" as const,
                        searchQuery: "",
                    },
                    1,
                    [Permission.ORDERS_LIST_OWN],
                    mockLogger,
                );

                // Assert
                const success = expectSuccess(result);
                const items = success.data?.orders[0].items;
                expect(items?.[0].product).toBeNull();
            });

            test("getOrder should return null product in response mapping", async () => {
                // Arrange
                prismaMock.order.findUnique.mockResolvedValueOnce(
                    mockOrderWithNullProductItem as unknown as Order,
                );

                // Act
                const result = await OrdersService.getOrder(
                    1,
                    1,
                    [Permission.ORDERS_READ_OWN],
                    mockLogger,
                );

                // Assert
                const success = expectSuccess(result);
                expect(success.data?.items[0].product).toBeNull();
            });
        });

        describe("deleteOrder / restoreOrder", () => {
            const mockOrderWithNullProductForDelete = {
                ...mockOrder,
                items: [
                    {
                        ...mockOrderItemNullProduct,
                        product: null,
                    },
                ],
            };

            test("deleteOrder should skip stock restore for null-product items", async () => {
                // Arrange
                prismaMock.order.findUnique.mockResolvedValueOnce(
                    mockOrderWithNullProductForDelete as unknown as Order,
                );
                prismaMock.order.update.mockResolvedValueOnce(mockOrder);
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.deleteOrder(1, mockContext, mockLogger);

                // Assert
                expectSuccess(result);
                expect(prismaMock.product.update).not.toHaveBeenCalled();
                expect(prismaMock.productHistory.create).not.toHaveBeenCalled();
            });

            test("restoreOrder should skip stock deduction for null-product items", async () => {
                // Arrange
                prismaMock.order.findFirst.mockResolvedValueOnce(
                    mockOrderWithNullProductForDelete as unknown as Order,
                );
                prismaMock.order.update.mockResolvedValueOnce(mockOrder);
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.restoreOrder(1, mockContext, mockLogger);

                // Assert
                expectSuccess(result);
                expect(prismaMock.product.update).not.toHaveBeenCalled();
                expect(prismaMock.productHistory.create).not.toHaveBeenCalled();
            });

            test("deleteOrder with mixed items should only restore stock for product-bound items", async () => {
                // Arrange
                const mixedOrder = {
                    ...mockOrder,
                    items: [
                        {
                            ...mockOrderItem,
                            product: { id: 1, remaining: 10, deletedAt: null },
                        },
                        {
                            ...mockOrderItemNullProduct,
                            id: 2,
                            product: null,
                        },
                    ],
                };
                prismaMock.order.findUnique.mockResolvedValueOnce(mixedOrder as unknown as Order);
                prismaMock.product.update.mockResolvedValueOnce(mockProduct);
                prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
                prismaMock.order.update.mockResolvedValueOnce(mockOrder);
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                await OrdersService.deleteOrder(1, mockContext, mockLogger);

                // Assert — stock restored only for item with productId=1
                expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
                expect(prismaMock.product.update).toHaveBeenCalledWith({
                    where: { id: 1 },
                    data: { remaining: { increment: 2 } },
                });
            });
        });

        describe("updateOrder — bind product to null-product item", () => {
            test("should deduct stock when binding product to previously null-product item", async () => {
                // Arrange — existing order has a null-product item
                const orderWithNullItem = {
                    ...mockOrder,
                    items: [
                        {
                            ...mockOrderItemNullProduct,
                            product: null,
                        },
                    ],
                };

                const updatedOrderWithProduct = {
                    ...mockOrder,
                    items: [
                        {
                            ...mockOrderItem,
                            product: {
                                id: 1,
                                name: "Test Product",
                                price: 100,
                                costprice: 80,
                                remaining: 8,
                            },
                        },
                    ],
                    user: null,
                    staff: { id: 1, fullname: "Test Staff" },
                };

                prismaMock.order.findUnique.mockResolvedValueOnce(
                    orderWithNullItem as unknown as Order,
                );
                prismaMock.product.findMany.mockResolvedValueOnce([mockProduct]);
                // No old stock restore (null product)
                // Delete old items
                prismaMock.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 });
                // Create new item + deduct stock
                prismaMock.orderItem.create.mockResolvedValueOnce({} as never);
                prismaMock.product.update.mockResolvedValueOnce(mockProduct);
                prismaMock.productHistory.create.mockResolvedValueOnce({} as never);
                // Update order
                prismaMock.order.update.mockResolvedValueOnce(
                    updatedOrderWithProduct as unknown as Order,
                );
                prismaMock.auditLog.create.mockResolvedValueOnce({} as AuditLog);

                // Act
                const result = await OrdersService.updateOrder(
                    1,
                    { items: [{ productId: 1, quantity: 2, price: 100 }] },
                    mockContext,
                    [Permission.ORDERS_UPDATE_OWN],
                    mockLogger,
                );

                // Assert
                expectSuccess(result);
                // No old stock restore (null product item)
                // Stock deducted for the newly bound product
                expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
                expect(prismaMock.product.update).toHaveBeenCalledWith({
                    where: { id: 1 },
                    data: { remaining: { decrement: 2 } },
                });
            });
        });
    });
});
