import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Permission } from "@jahonbozor/schemas";

import { createMockLogger } from "@backend/test/setup";

import { OrdersService } from "../orders.service";

const mockOrderWithRelations = {
    id: 1,
    userId: null,
    staffId: 1,
    paymentType: "CASH",
    status: "COMPLETED",
    type: "ORDER",
    comment: null,
    data: {},
    items: [
        {
            id: 1,
            orderId: 1,
            productId: 1,
            quantity: 2,
            price: 100,
            data: null,
            product: { id: 1, name: "Test Product", price: 100, remaining: 10 },
        },
    ],
    user: null,
    staff: { id: 1, fullname: "Test Staff" },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

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
                Permission.ORDERS_LIST_OWN,
                Permission.ORDERS_LIST_ALL,
                Permission.ORDERS_READ_OWN,
                Permission.ORDERS_READ_ALL,
                Permission.ORDERS_CREATE,
                Permission.ORDERS_UPDATE_OWN,
                Permission.ORDERS_UPDATE_ALL,
                Permission.ORDERS_DELETE,
            ] as Permission[],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/orders", async ({ query, user, permissions, logger }) => {
            return await OrdersService.getAllOrders(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    searchQuery: "",
                    userId: query.userId ? Number(query.userId) : undefined,
                    staffId: query.staffId ? Number(query.staffId) : undefined,
                    paymentType: query.paymentType as "CASH" | "CREDIT_CARD" | undefined,
                },
                user.id,
                permissions,
                logger,
            );
        })
        .get("/orders/:id", async ({ params, user, permissions, logger }) => {
            return await OrdersService.getOrder(Number(params.id), user.id, permissions, logger);
        })
        .post("/orders", async ({ body, user, logger, requestId }) => {
            return await OrdersService.createOrder(
                body as {
                    paymentType: "CASH" | "CREDIT_CARD";
                    items: { productId: number | null; quantity: number; price: number }[];
                },
                { staffId: user.id, user, requestId },
                logger,
            );
        })
        .patch("/orders/:id", async ({ params, body, user, permissions, logger, requestId }) => {
            return await OrdersService.updateOrder(
                Number(params.id),
                body as { paymentType?: "CASH" | "CREDIT_CARD" },
                { staffId: user.id, user, requestId },
                permissions,
                logger,
            );
        })
        .delete("/orders/:id", async ({ params, user, logger, requestId }) => {
            return await OrdersService.deleteOrder(
                Number(params.id),
                { staffId: user.id, user, requestId },
                logger,
            );
        });
};

describe("Orders API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /orders", () => {
        test("should return paginated orders list", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
                success: true,
                data: { count: 2, orders: [mockOrderWithRelations] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);
            expect(body.data.orders).toHaveLength(1);

            spy.mockRestore();
        });

        test("should apply paymentType filter", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
                success: true,
                data: { count: 1, orders: [mockOrderWithRelations] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders?paymentType=CASH"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ paymentType: "CASH" }),
                expect.any(Number),
                expect.any(Array),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return empty list when no orders found", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
                success: true,
                data: { count: 0, orders: [] },
            });

            // Act
            const response = await app.handle(new Request("http://localhost/orders"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.orders).toHaveLength(0);

            spy.mockRestore();
        });
    });

    describe("GET /orders/:id", () => {
        test("should return order by id", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: true,
                data: mockOrderWithRelations,
            });

            // Act
            const response = await app.handle(new Request("http://localhost/orders/1"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/orders/999"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Order not found");

            spy.mockRestore();
        });

        test("should return Forbidden when access denied", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: false,
                error: "Forbidden",
            });

            // Act
            const response = await app.handle(new Request("http://localhost/orders/1"));
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Forbidden");

            spy.mockRestore();
        });
    });

    describe("POST /orders", () => {
        test("should create order with valid data", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "createOrder").mockResolvedValue({
                success: true,
                data: mockOrderWithRelations,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paymentType: "CASH",
                        items: [{ productId: 1, quantity: 2, price: 100 }],
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when products not found", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "createOrder").mockResolvedValue({
                success: false,
                error: "Products not found: 999",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        paymentType: "CASH",
                        items: [{ productId: 999, quantity: 2, price: 100 }],
                    }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Products not found: 999");

            spy.mockRestore();
        });
    });

    describe("PATCH /orders/:id", () => {
        test("should update order paymentType", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, paymentType: "CREDIT_CARD" };
            const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: true,
                data: updatedOrder,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentType: "CREDIT_CARD" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.paymentType).toBe("CREDIT_CARD");

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentType: "CREDIT_CARD" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Order not found");

            spy.mockRestore();
        });

        test("should return Forbidden when access denied", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: false,
                error: "Forbidden",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paymentType: "CREDIT_CARD" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Forbidden");

            spy.mockRestore();
        });
    });

    describe("DELETE /orders/:id", () => {
        test("should delete order successfully", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "deleteOrder").mockResolvedValue({
                success: true,
                data: { orderId: 1, deleted: true },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(true);

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = vi.spyOn(OrdersService, "deleteOrder").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/999", { method: "DELETE" }),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Order not found");

            spy.mockRestore();
        });
    });
});

describe("Orders Service Integration", () => {
    test("getAllOrders should be called with correct pagination", async () => {
        // Arrange
        const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
            success: true,
            data: { count: 0, orders: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/orders?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                page: 3,
                limit: 15,
                sortBy: "id",
                sortOrder: "asc" as const,
            }),
            expect.any(Number),
            expect.any(Array),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getOrder should be called with correct id", async () => {
        // Arrange
        const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/orders/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            42,
            expect.any(Number),
            expect.any(Array),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("createOrder should be called with context", async () => {
        // Arrange
        const spy = vi.spyOn(OrdersService, "createOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentType: "CASH",
                    items: [{ productId: 1, quantity: 2, price: 100 }],
                }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ paymentType: "CASH" }),
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("updateOrder should be called with context", async () => {
        // Arrange
        const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/orders/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentType: "CREDIT_CARD" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            { paymentType: "CREDIT_CARD" },
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.any(Array),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteOrder should be called with context", async () => {
        // Arrange
        const spy = vi.spyOn(OrdersService, "deleteOrder").mockResolvedValue({
            success: true,
            data: { orderId: 1, deleted: true },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/orders/1", { method: "DELETE" }));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });
});

describe("Orders API — null-product items", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    const mockOrderWithNullProduct = {
        ...mockOrderWithRelations,
        items: [
            {
                id: 1,
                orderId: 1,
                productId: null,
                quantity: 3,
                price: 150,
                data: null,
                product: null,
            },
        ],
    };

    const mockOrderWithMixedItems = {
        ...mockOrderWithRelations,
        items: [
            {
                id: 1,
                orderId: 1,
                productId: 1,
                quantity: 2,
                price: 100,
                data: null,
                product: { id: 1, name: "Test Product", price: 100, remaining: 10 },
            },
            {
                id: 2,
                orderId: 1,
                productId: null,
                quantity: 5,
                price: 200,
                data: null,
                product: null,
            },
        ],
    };

    test("POST /orders with null-product item should succeed", async () => {
        const spy = vi.spyOn(OrdersService, "createOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithNullProduct,
        });

        const response = await app.handle(
            new Request("http://localhost/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentType: "CASH",
                    items: [{ productId: null, quantity: 3, price: 150 }],
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.items[0].productId).toBeNull();
        expect(body.data.items[0].product).toBeNull();
        expect(body.data.items[0].price).toBe(150);

        spy.mockRestore();
    });

    test("POST /orders with mixed items (product + null) should succeed", async () => {
        const spy = vi.spyOn(OrdersService, "createOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithMixedItems,
        });

        const response = await app.handle(
            new Request("http://localhost/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentType: "CASH",
                    items: [
                        { productId: 1, quantity: 2, price: 100 },
                        { productId: null, quantity: 5, price: 200 },
                    ],
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(2);
        expect(body.data.items[0].productId).toBe(1);
        expect(body.data.items[0].product).not.toBeNull();
        expect(body.data.items[1].productId).toBeNull();
        expect(body.data.items[1].product).toBeNull();

        spy.mockRestore();
    });

    test("GET /orders should return orders with null-product items", async () => {
        const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
            success: true,
            data: { count: 1, orders: [mockOrderWithNullProduct] },
        });

        const response = await app.handle(new Request("http://localhost/orders"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.orders[0].items[0].product).toBeNull();
        expect(body.data.orders[0].items[0].productId).toBeNull();

        spy.mockRestore();
    });

    test("GET /orders/:id should return order with null-product item", async () => {
        const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithNullProduct,
        });

        const response = await app.handle(new Request("http://localhost/orders/1"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.items[0].product).toBeNull();

        spy.mockRestore();
    });

    test("PATCH /orders/:id — bind product to null-product item should succeed", async () => {
        const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations, // now has product bound
        });

        const response = await app.handle(
            new Request("http://localhost/orders/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: [{ productId: 1, quantity: 3, price: 150 }],
                }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.items[0].productId).toBe(1);

        spy.mockRestore();
    });

    test("DELETE /orders/:id with null-product items should succeed", async () => {
        const spy = vi.spyOn(OrdersService, "deleteOrder").mockResolvedValue({
            success: true,
            data: { orderId: 1, deleted: true },
        });

        const response = await app.handle(
            new Request("http://localhost/orders/1", { method: "DELETE" }),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);

        spy.mockRestore();
    });
});

describe("Orders API edge cases", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    test("GET /orders with no results should return empty list", async () => {
        const spy = vi.spyOn(OrdersService, "getAllOrders").mockResolvedValue({
            success: true,
            data: { count: 0, orders: [] },
        });

        const response = await app.handle(new Request("http://localhost/orders"));
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.data.count).toBe(0);
        expect(body.data.orders).toEqual([]);

        spy.mockRestore();
    });

    test("GET /orders/:id with id=0 should call service", async () => {
        const spy = vi.spyOn(OrdersService, "getOrder").mockResolvedValue({
            success: false,
            error: "Order not found",
        });

        const response = await app.handle(new Request("http://localhost/orders/0"));
        const body = await response.json();

        expect(body.success).toBe(false);
        expect(body.error).toBe("Order not found");

        spy.mockRestore();
    });

    test("PATCH /orders/:id with empty body should call service", async () => {
        const spy = vi.spyOn(OrdersService, "updateOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });

        const response = await app.handle(
            new Request("http://localhost/orders/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
        );
        const body = await response.json();

        expect(body.success).toBe(true);

        spy.mockRestore();
    });

    test("DELETE /orders/:id should handle service error", async () => {
        const spy = vi.spyOn(OrdersService, "deleteOrder").mockResolvedValue({
            success: false,
            error: "Database error",
        });

        const response = await app.handle(
            new Request("http://localhost/orders/1", { method: "DELETE" }),
        );
        const body = await response.json();

        expect(body.success).toBe(false);

        spy.mockRestore();
    });
});
