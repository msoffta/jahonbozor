import { describe, test, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { Permission } from "@jahonbozor/schemas";
import { AuditLogService } from "../audit-logs.service";
import type { AuditLog } from "@backend/generated/prisma/client";

// Mock audit log data
const mockAuditLog: AuditLog = {
    id: 1,
    requestId: "req-123",
    actorId: 10,
    actorType: "STAFF",
    entityType: "product",
    entityId: 100,
    action: "CREATE",
    previousData: null,
    newData: { name: "Test Product" },
    metadata: null,
    createdAt: new Date("2024-01-01T10:00:00Z"),
};

const mockAuditLog2: AuditLog = {
    id: 2,
    requestId: "req-123",
    actorId: 10,
    actorType: "STAFF",
    entityType: "product",
    entityId: 100,
    action: "UPDATE",
    previousData: { name: "Test Product" },
    newData: { name: "Updated Product" },
    metadata: null,
    createdAt: new Date("2024-01-01T11:00:00Z"),
};

// Mock staff token for authorization
const mockStaffToken = {
    id: 10,
    type: "staff" as const,
    fullname: "Admin User",
    username: "admin",
    telegramId: "staff123456",
    roleId: 1,
};

// Create test app with mocked middleware
const createTestApp = () => {
    const mockLogger = createMockLogger();

    return new Elysia()
        .derive(() => ({
            user: mockStaffToken,
            permissions: [
                Permission.AUDIT_LOGS_LIST,
                Permission.AUDIT_LOGS_READ,
            ],
            logger: mockLogger,
            requestId: "test-request-id",
        }))
        .get("/audit-logs", async ({ query, logger }) => {
            return await AuditLogService.getAll(
                {
                    page: Number(query.page) || 1,
                    limit: Number(query.limit) || 20,
                    searchQuery: "",
                    entityType: query.entityType as string | undefined,
                    entityId: query.entityId ? Number(query.entityId) : undefined,
                    actorId: query.actorId ? Number(query.actorId) : undefined,
                    actorType: query.actorType as "STAFF" | "USER" | "SYSTEM" | undefined,
                    action: query.action as "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "LOGIN" | "LOGOUT" | "PASSWORD_CHANGE" | "PERMISSION_CHANGE" | "ORDER_STATUS_CHANGE" | "INVENTORY_ADJUST" | undefined,
                    requestId: query.requestId as string | undefined,
                    dateFrom: query.dateFrom ? new Date(query.dateFrom as string) : undefined,
                    dateTo: query.dateTo ? new Date(query.dateTo as string) : undefined,
                },
                logger,
            );
        })
        .get("/audit-logs/:id", async ({ params, set, logger }) => {
            const result = await AuditLogService.getById(Number(params.id), logger);
            if (!result.success) set.status = 404;
            return result;
        })
        .get("/audit-logs/by-request/:requestId", async ({ params, logger }) => {
            return await AuditLogService.getByRequestId(params.requestId, logger);
        })
        .get("/audit-logs/by-entity/:entityType/:entityId", async ({ params, logger }) => {
            return await AuditLogService.getByEntity(
                params.entityType,
                Number(params.entityId),
                logger,
            );
        });
};

describe("AuditLogs API Endpoints", () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        app = createTestApp();
    });

    describe("GET /audit-logs", () => {
        test("should return paginated audit logs", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?page=1&limit=20"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.count).toBe(2);
            expect(success.data?.auditLogs).toHaveLength(2);
        });

        test("should filter by entityType", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?entityType=product"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should filter by entityId", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?entityId=100"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should filter by actorId and actorType", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?actorId=10&actorType=STAFF"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should filter by action", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockAuditLog]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?action=CREATE"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data?.count).toBe(1);
        });

        test("should filter by requestId", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?requestId=req-123"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        test("should return empty list when no logs found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs?entityType=nonexistent"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data).toEqual({ count: 0, auditLogs: [] });
        });
    });

    describe("GET /audit-logs/:id", () => {
        test("should return audit log by id", async () => {
            // Arrange
            prismaMock.auditLog.findUnique.mockResolvedValue(mockAuditLog);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/1"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.id).toBe(1);
            expect(success.data?.entityType).toBe("product");
        });

        test("should return 404 when audit log not found", async () => {
            // Arrange
            prismaMock.auditLog.findUnique.mockResolvedValue(null);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/999"),
            );

            // Assert
            expect(response.status).toBe(404);
            const body = await response.json();
            const failure = expectFailure(body);
            expect(failure.error).toBe("Audit log entry not found");
        });
    });

    describe("GET /audit-logs/by-request/:requestId", () => {
        test("should return all logs for requestId", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([mockAuditLog, mockAuditLog2]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/by-request/req-123"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.count).toBe(2);
            expect(success.data?.auditLogs).toHaveLength(2);
        });

        test("should return empty array when no logs found", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/by-request/nonexistent"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data).toEqual({ count: 0, auditLogs: [] });
        });
    });

    describe("GET /audit-logs/by-entity/:entityType/:entityId", () => {
        test("should return all logs for entity", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([mockAuditLog, mockAuditLog2]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/by-entity/product/100"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            const success = expectSuccess(body);
            expect(success.data?.count).toBe(2);
            expect(success.data?.auditLogs).toHaveLength(2);
        });

        test("should return empty array when no logs found for entity", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            // Act
            const response = await app.handle(
                new Request("http://localhost/audit-logs/by-entity/nonexistent/999"),
            );

            // Assert
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data).toEqual({ count: 0, auditLogs: [] });
        });
    });

    describe("edge cases", () => {
        test("GET /audit-logs/:id with id=0 should return 404", async () => {
            prismaMock.auditLog.findUnique.mockResolvedValue(null);

            const response = await app.handle(
                new Request("http://localhost/audit-logs/0"),
            );

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.success).toBe(false);
            expect(body.error).toBe("Audit log entry not found");
        });

        test("GET /audit-logs/by-request/:requestId with non-existent requestId should return empty", async () => {
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            const response = await app.handle(
                new Request("http://localhost/audit-logs/by-request/non-existent-id"),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.count).toBe(0);
            expect(body.data.auditLogs).toEqual([]);
        });

        test("GET /audit-logs with all filters combined should return results", async () => {
            prismaMock.$transaction.mockResolvedValue([1, [mockAuditLog]]);

            const response = await app.handle(
                new Request("http://localhost/audit-logs?entityType=product&entityId=100&actorId=10&actorType=STAFF&action=CREATE&requestId=req-123&dateFrom=2024-01-01&dateTo=2024-12-31"),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.count).toBe(1);
        });

        test("GET /audit-logs with empty results should return empty list", async () => {
            prismaMock.$transaction.mockResolvedValue([0, []]);

            const response = await app.handle(
                new Request("http://localhost/audit-logs"),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.count).toBe(0);
            expect(body.data.auditLogs).toEqual([]);
        });
    });
});
