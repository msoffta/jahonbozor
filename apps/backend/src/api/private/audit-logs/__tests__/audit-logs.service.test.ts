import { describe, test, expect, beforeEach } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import { AuditLogService } from "../audit-logs.service";
import type { AuditLog } from "@generated/prisma/client";

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

const mockAuditLog3: AuditLog = {
    id: 3,
    requestId: "req-456",
    actorId: 5,
    actorType: "USER",
    entityType: "order",
    entityId: 200,
    action: "CREATE",
    previousData: null,
    newData: { status: "NEW" },
    metadata: { ipAddress: "192.168.1.1" },
    createdAt: new Date("2024-01-02T10:00:00Z"),
};

describe("AuditLogService", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("getAll", () => {
        test("should return paginated audit logs", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([3, [mockAuditLog, mockAuditLog2, mockAuditLog3]]);

            // Act
            const result = await AuditLogService.getAll({ page: 1, limit: 20 }, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                count: 3,
                auditLogs: [mockAuditLog, mockAuditLog2, mockAuditLog3],
            });
        });

        test("should filter by entityType", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, entityType: "product" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(2);
            expect(success.data?.auditLogs).toHaveLength(2);
        });

        test("should filter by entityId", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, entityId: 100 },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(2);
        });

        test("should filter by actorId and actorType", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, actorId: 10, actorType: "STAFF" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(2);
        });

        test("should filter by action", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockAuditLog]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, action: "CREATE" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by date range (dateFrom)", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([1, [mockAuditLog3]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, dateFrom: new Date("2024-01-02T00:00:00Z") },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(1);
        });

        test("should filter by date range (dateTo)", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, dateTo: new Date("2024-01-01T23:59:59Z") },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(2);
        });

        test("should filter by requestId", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([2, [mockAuditLog, mockAuditLog2]]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, requestId: "req-123" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data?.count).toBe(2);
        });

        test("should return empty array when no logs found", async () => {
            // Arrange
            prismaMock.$transaction.mockResolvedValue([0, []]);

            // Act
            const result = await AuditLogService.getAll(
                { page: 1, limit: 20, entityType: "nonexistent" },
                mockLogger,
            );

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, auditLogs: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database connection failed");
            prismaMock.$transaction.mockRejectedValue(dbError);

            // Act
            const result = await AuditLogService.getAll({ page: 1, limit: 20 }, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalledWith("AuditLog: Error in getAll", {
                page: 1,
                limit: 20,
                error: dbError,
            });
        });
    });

    describe("getById", () => {
        test("should return audit log by id", async () => {
            // Arrange
            prismaMock.auditLog.findUnique.mockResolvedValue(mockAuditLog);

            // Act
            const result = await AuditLogService.getById(1, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual(mockAuditLog);
        });

        test("should return error when audit log not found", async () => {
            // Arrange
            prismaMock.auditLog.findUnique.mockResolvedValue(null);

            // Act
            const result = await AuditLogService.getById(999, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe("Audit log entry not found");
            expect(mockLogger.warn).toHaveBeenCalledWith("AuditLog: Entry not found", {
                auditLogId: 999,
            });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.auditLog.findUnique.mockRejectedValue(dbError);

            // Act
            const result = await AuditLogService.getById(1, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalledWith("AuditLog: Error in getById", {
                auditLogId: 1,
                error: dbError,
            });
        });
    });

    describe("getByRequestId", () => {
        test("should return all logs for requestId", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([mockAuditLog, mockAuditLog2]);

            // Act
            const result = await AuditLogService.getByRequestId("req-123", mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                count: 2,
                auditLogs: [mockAuditLog, mockAuditLog2],
            });
        });

        test("should return empty array when no logs found", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            // Act
            const result = await AuditLogService.getByRequestId("nonexistent", mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, auditLogs: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.auditLog.findMany.mockRejectedValue(dbError);

            // Act
            const result = await AuditLogService.getByRequestId("req-123", mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalledWith("AuditLog: Error in getByRequestId", {
                requestId: "req-123",
                error: dbError,
            });
        });
    });

    describe("getByEntity", () => {
        test("should return all logs for entity", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([mockAuditLog, mockAuditLog2]);

            // Act
            const result = await AuditLogService.getByEntity("product", 100, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({
                count: 2,
                auditLogs: [mockAuditLog, mockAuditLog2],
            });
        });

        test("should return empty array when no logs found", async () => {
            // Arrange
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            // Act
            const result = await AuditLogService.getByEntity("nonexistent", 999, mockLogger);

            // Assert
            const success = expectSuccess(result);
            expect(success.data).toEqual({ count: 0, auditLogs: [] });
        });

        test("should handle database error", async () => {
            // Arrange
            const dbError = new Error("Database error");
            prismaMock.auditLog.findMany.mockRejectedValue(dbError);

            // Act
            const result = await AuditLogService.getByEntity("product", 100, mockLogger);

            // Assert
            const failure = expectFailure(result);
            expect(failure.error).toBe(dbError);
            expect(mockLogger.error).toHaveBeenCalledWith("AuditLog: Error in getByEntity", {
                entityType: "product",
                entityId: 100,
                error: dbError,
            });
        });
    });
});
