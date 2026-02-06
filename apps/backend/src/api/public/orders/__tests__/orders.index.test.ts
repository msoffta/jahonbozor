import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@test/setup";
import { PublicOrdersService } from "../orders.service";

const mockOrderWithRelations = {
    id: 1,
    userId: 1,
    staffId: null,
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
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
};

const mockUser = {
    id: 1,
    type: "user" as const,
    fullname: "Test User",
    username: "testuser",
    phone: "998901234567",
    telegramId: "123456789",
};

const mockStaff = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Staff",
    username: "teststaff",
    telegramId: "123456789",
    roleId: 1,
};

const createTestApp = (userType: "user" | "staff" = "user") => {
    const mockLogger = createMockLogger();
    const user = userType === "user" ? mockUser : mockStaff;

    return new Elysia()
        .derive(() => ({
            user,
            type: userType,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .post("/orders", async ({ body, user, type, logger, requestId }) => {
            if (type !== "user") {
                return { success: false, error: "Only users can create orders via public API" };
            }
            return await PublicOrdersService.createOrder(
                body as { paymentType: "CASH" | "CREDIT_CARD"; items: Array<{ productId: number; quantity: number; price: number }> },
                { userId: user.id, user, requestId },
                logger,
            );
        })
        .get("/orders", async ({ query, user, type, logger }) => {
            if (type !== "user") {
                return { success: false, error: "Only users can access this endpoint" };
            }
            return await PublicOrdersService.getUserOrders(
                user.id,
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: "",
                    paymentType: query.paymentType as "CASH" | "CREDIT_CARD" | undefined,
                    status: query.status as "NEW" | "ACCEPTED" | undefined,
                },
                logger,
            );
        })
        .get("/orders/:id", async ({ params, user, type, logger }) => {
            if (type !== "user") {
                return { success: false, error: "Only users can access this endpoint" };
            }
            return await PublicOrdersService.getUserOrder(Number(params.id), user.id, logger);
        });
};

describe("Public Orders API Routes", () => {
    describe("POST /orders", () => {
        test("should create order for user", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "createOrder").mockResolvedValue({
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

        test("should reject if type is not user", async () => {
            // Arrange
            const app = createTestApp("staff");

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
            expect(body.success).toBe(false);
            expect(body.error).toBe("Only users can create orders via public API");
        });

        test("should pass context with requestId", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "createOrder").mockResolvedValue({
                success: true,
                data: mockOrderWithRelations,
            });

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
                expect.objectContaining({ userId: 1, requestId: "test-request-id" }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("GET /orders", () => {
        test("should return user's orders", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "getUserOrders").mockResolvedValue({
                success: true,
                data: { count: 1, orders: [mockOrderWithRelations] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(1);

            spy.mockRestore();
        });

        test("should reject if type is not user", async () => {
            // Arrange
            const app = createTestApp("staff");

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Only users can access this endpoint");
        });

        test("should apply filters", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "getUserOrders").mockResolvedValue({
                success: true,
                data: { count: 1, orders: [mockOrderWithRelations] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders?paymentType=CASH&status=NEW"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(spy).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ paymentType: "CASH", status: "NEW" }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("GET /orders/:id", () => {
        test("should return user's order by id", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "getUserOrder").mockResolvedValue({
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

        test("should reject if type is not user", async () => {
            // Arrange
            const app = createTestApp("staff");

            // Act
            const response = await app.handle(
                new Request("http://localhost/orders/1"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("Only users can access this endpoint");
        });

        test("should return error when order not found", async () => {
            // Arrange
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "getUserOrder").mockResolvedValue({
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
            const app = createTestApp("user");
            const spy = spyOn(PublicOrdersService, "getUserOrder").mockResolvedValue({
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
});

describe("Public Orders Service Integration", () => {
    test("createOrder should be called with context", async () => {
        // Arrange
        const app = createTestApp("user");
        const spy = spyOn(PublicOrdersService, "createOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });

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
            expect.objectContaining({
                userId: 1,
                user: expect.objectContaining({ type: "user" }),
                requestId: "test-request-id",
            }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getUserOrders should be called with correct userId", async () => {
        // Arrange
        const app = createTestApp("user");
        const spy = spyOn(PublicOrdersService, "getUserOrders").mockResolvedValue({
            success: true,
            data: { count: 0, orders: [] },
        });

        // Act
        await app.handle(new Request("http://localhost/orders?page=2&limit=10"));

        // Assert
        expect(spy).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ page: 2, limit: 10 }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("getUserOrder should be called with correct params", async () => {
        // Arrange
        const app = createTestApp("user");
        const spy = spyOn(PublicOrdersService, "getUserOrder").mockResolvedValue({
            success: true,
            data: mockOrderWithRelations,
        });

        // Act
        await app.handle(new Request("http://localhost/orders/42"));

        // Assert
        expect(spy).toHaveBeenCalledWith(42, 1, expect.anything());

        spy.mockRestore();
    });
});
