import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@test/setup";
import { Permission } from "@jahonbozor/schemas";
import { OrdersService } from "../orders.service";

const mockOrderWithRelations = {
    id: 1,
    userId: null,
    staffId: 1,
    paymentType: "CASH",
    status: "NEW",
    data: {},
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
                    searchQuery: "",
                    userId: query.userId ? Number(query.userId) : undefined,
                    staffId: query.staffId ? Number(query.staffId) : undefined,
                    paymentType: query.paymentType as "CASH" | "CREDIT_CARD" | undefined,
                    status: query.status as "NEW" | "ACCEPTED" | undefined,
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
                body as { paymentType: "CASH" | "CREDIT_CARD"; items: Array<{ productId: number; quantity: number; price: number }> },
                { staffId: user.id, user, requestId },
                logger,
            );
        })
        .patch("/orders/:id", async ({ params, body, user, permissions, logger, requestId }) => {
            return await OrdersService.updateOrder(
                Number(params.id),
                body as { paymentType?: "CASH" | "CREDIT_CARD"; status?: "NEW" | "ACCEPTED" },
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
            const spy = spyOn(OrdersService, "getAllOrders").mockResolvedValue({
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
            const spy = spyOn(OrdersService, "getAllOrders").mockResolvedValue({
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

        test("should apply status filter", async () => {
            // Arrange
            const spy = spyOn(OrdersService, "getAllOrders").mockResolvedValue({
                success: true,
                data: { count: 1, orders: [mockOrderWithRelations] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders?status=NEW"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ status: "NEW" }),
                expect.any(Number),
                expect.any(Array),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return empty list when no orders found", async () => {
            // Arrange
            const spy = spyOn(OrdersService, "getAllOrders").mockResolvedValue({
                success: true,
                data: { count: 0, orders: [] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders"),
            );
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
            const spy = spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: true,
                data: mockOrderWithRelations,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Order not found");

            spy.mockRestore();
        });

        test("should return Forbidden when access denied", async () => {
            // Arrange
            const spy = spyOn(OrdersService, "getOrder").mockResolvedValue({
                success: false,
                error: "Forbidden",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1"),
            );
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
            const spy = spyOn(OrdersService, "createOrder").mockResolvedValue({
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
            const spy = spyOn(OrdersService, "createOrder").mockResolvedValue({
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
        test("should update order status", async () => {
            // Arrange
            const updatedOrder = { ...mockOrderWithRelations, status: "ACCEPTED" };
            const spy = spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: true,
                data: updatedOrder,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "ACCEPTED" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("ACCEPTED");

            spy.mockRestore();
        });

        test("should return error when order not found", async () => {
            // Arrange
            const spy = spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: false,
                error: "Order not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/999", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "ACCEPTED" }),
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
            const spy = spyOn(OrdersService, "updateOrder").mockResolvedValue({
                success: false,
                error: "Forbidden",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "ACCEPTED" }),
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
            const spy = spyOn(OrdersService, "deleteOrder").mockResolvedValue({
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
            const spy = spyOn(OrdersService, "deleteOrder").mockResolvedValue({
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
        const spy = spyOn(OrdersService, "getAllOrders").mockResolvedValue({
            success: true,
            data: { count: 0, orders: [] },
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/orders?page=3&limit=15"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ page: 3, limit: 15 }),
            expect.any(Number),
            expect.any(Array),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getOrder should be called with correct id", async () => {
        // Arrange
        const spy = spyOn(OrdersService, "getOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });
        const app = createTestApp();

        // Act
        await app.handle(new Request("http://localhost/orders/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(42, expect.any(Number), expect.any(Array), expect.anything());

        spy.mockRestore();
    });

    test("createOrder should be called with context", async () => {
        // Arrange
        const spy = spyOn(OrdersService, "createOrder").mockResolvedValue({
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
        const spy = spyOn(OrdersService, "updateOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });
        const app = createTestApp();

        // Act
        await app.handle(
            new Request("http://localhost/orders/1", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "ACCEPTED" }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            { status: "ACCEPTED" },
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.any(Array),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("deleteOrder should be called with context", async () => {
        // Arrange
        const spy = spyOn(OrdersService, "deleteOrder").mockResolvedValue({
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
