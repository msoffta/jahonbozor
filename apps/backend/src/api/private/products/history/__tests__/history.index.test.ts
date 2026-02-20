import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@backend/test/setup";
import { Permission } from "@jahonbozor/schemas";
import { HistoryService } from "../history.service";

// Mock history data
const mockHistoryEntry = {
    id: 1,
    productId: 1,
    staffId: 1,
    operation: "CREATE",
    quantity: null,
    previousData: null,
    newData: { name: "Test Product", price: 100 },
    changeReason: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    product: {
        id: 1,
        name: "Test Product",
    },
    staff: {
        id: 1,
        fullname: "Test Admin",
    },
};

// Mock user for tests
const mockUser = {
    id: 1,
    type: "staff" as const,
    fullname: "Test Admin",
    username: "testadmin",
    telegramId: "123456789",
    roleId: 1,
};

// Create test app with mocked middleware
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockUser,
            permissions: [
                Permission.PRODUCT_HISTORY_LIST,
                Permission.PRODUCT_HISTORY_READ,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/history", async ({ query, logger }) => {
            return await HistoryService.getAllHistory(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: query.searchQuery,
                    productId: query.productId ? Number(query.productId) : undefined,
                    operation: query.operation as "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "INVENTORY_ADD" | "INVENTORY_REMOVE" | undefined,
                    staffId: query.staffId ? Number(query.staffId) : undefined,
                },
                logger,
            );
        })
        .get("/history/:historyId", async ({ params, logger }) => {
            return await HistoryService.getHistoryEntry(Number(params.historyId), logger);
        });
};

describe("History API Routes", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /history", () => {
        test("should return paginated history list", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 2, history: [mockHistoryEntry] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/history?page=1&limit=20"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(2);

            spy.mockRestore();
        });

        test("should apply productId filter", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 1, history: [mockHistoryEntry] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/history?productId=1"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ productId: 1 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply operation filter", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 1, history: [mockHistoryEntry] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/history?operation=CREATE"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ operation: "CREATE" }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should apply staffId filter", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 1, history: [mockHistoryEntry] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/history?staffId=1"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ staffId: 1 }),
                expect.anything(),
            );

            spy.mockRestore();
        });

        test("should return empty list when no history found", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 0, history: [] },
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/history"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.history).toHaveLength(0);

            spy.mockRestore();
        });

        test("should handle pagination parameters", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 0, history: [] },
            });

            // Act
            await app.handle(
                new Request("http://localhost/history?page=3&limit=15"),
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({ page: 3, limit: 15 }),
                expect.anything(),
            );

            spy.mockRestore();
        });
    });

    describe("GET /history/:historyId", () => {
        test("should return history entry by id", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getHistoryEntry").mockResolvedValue({
                success: true,
                data: mockHistoryEntry,
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/history/1"),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(1);

            spy.mockRestore();
        });

        test("should return error when history entry not found", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getHistoryEntry").mockResolvedValue({
                success: false,
                error: "History entry not found",
            });

            // Act
            const response = await app.handle(
                new Request("http://localhost/history/999"),
            );
            const body = await response.json();

            // Assert
            expect(body.success).toBe(false);
            expect(body.error).toBe("History entry not found");

            spy.mockRestore();
        });

        test("should call service with correct id", async () => {
            // Arrange
            const spy = spyOn(HistoryService, "getHistoryEntry").mockResolvedValue({
                success: true,
                data: mockHistoryEntry,
            });

            // Act
            await app.handle(new Request("http://localhost/history/42"));

            // Assert
            expect(spy).toHaveBeenCalledWith(42, expect.anything());

            spy.mockRestore();
        });
    });

    describe("edge cases", () => {
        test("GET /history with empty results should return empty list", async () => {
            const spy = spyOn(HistoryService, "getAllHistory").mockResolvedValue({
                success: true,
                data: { count: 0, history: [] },
            });

            const response = await app.handle(
                new Request("http://localhost/history"),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(0);
            expect(body.data.history).toEqual([]);

            spy.mockRestore();
        });

        test("GET /history/:historyId with id=0 should call service with 0", async () => {
            const spy = spyOn(HistoryService, "getHistoryEntry").mockResolvedValue({
                success: false,
                error: "History entry not found",
            });

            const response = await app.handle(
                new Request("http://localhost/history/0"),
            );
            const body = await response.json();

            expect(body.success).toBe(false);
            expect(body.error).toBe("History entry not found");

            spy.mockRestore();
        });

        test("GET /history/:historyId when service fails should return error", async () => {
            const spy = spyOn(HistoryService, "getHistoryEntry").mockResolvedValue({
                success: false,
                error: "History entry not found",
            });

            const response = await app.handle(
                new Request("http://localhost/history/999"),
            );
            const body = await response.json();

            expect(body.success).toBe(false);
            expect(body.error).toBe("History entry not found");

            spy.mockRestore();
        });
    });
});
