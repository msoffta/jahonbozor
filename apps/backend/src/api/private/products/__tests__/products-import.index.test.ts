import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger } from "@backend/test/setup";

import { ProductsService } from "../products.service";

const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    roleId: 1,
};

const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .post("/products/import", async ({ body, logger, requestId }) => {
            const { products } = body as {
                products: {
                    name: string;
                    price: number;
                    costprice: number;
                    remaining: number;
                }[];
            };
            return await ProductsService.importProducts(
                products,
                { staffId: mockUser.id, user: mockUser, requestId },
                logger,
            );
        });
};

describe("POST /products/import", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    test("should return success with created/updated counts", async () => {
        // Arrange
        const spy = vi.spyOn(ProductsService, "importProducts").mockResolvedValue({
            success: true,
            data: { created: 2, updated: 1, total: 3 },
        });

        // Act
        const response = await app.handle(
            new Request("http://localhost/products/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    products: [
                        { name: "A", price: 100, costprice: 50, remaining: 10 },
                        { name: "B", price: 200, costprice: 100, remaining: 5 },
                        { name: "C", price: 300, costprice: 150, remaining: 20 },
                    ],
                }),
            }),
        );
        const body = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data).toEqual({ created: 2, updated: 1, total: 3 });

        spy.mockRestore();
    });

    test("should pass products array and context to service", async () => {
        // Arrange
        const spy = vi.spyOn(ProductsService, "importProducts").mockResolvedValue({
            success: true,
            data: { created: 1, updated: 0, total: 1 },
        });

        const products = [{ name: "Product A", price: 100, costprice: 50, remaining: 10 }];

        // Act
        await app.handle(
            new Request("http://localhost/products/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ products }),
            }),
        );

        // Assert
        expect(spy).toHaveBeenCalledWith(
            products,
            expect.objectContaining({ staffId: 1, requestId: "test-request-id" }),
            expect.anything(),
        );

        spy.mockRestore();
    });

    test("should return error when service fails", async () => {
        // Arrange
        const spy = vi.spyOn(ProductsService, "importProducts").mockResolvedValue({
            success: false,
            error: "DB error",
        });

        // Act
        const response = await app.handle(
            new Request("http://localhost/products/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    products: [{ name: "A", price: 100, costprice: 50, remaining: 0 }],
                }),
            }),
        );
        const body = await response.json();

        // Assert
        expect(body.success).toBe(false);

        spy.mockRestore();
    });
});
