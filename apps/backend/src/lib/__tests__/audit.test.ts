import { beforeEach, describe, expect, test } from "vitest";

import { createMockLogger, prismaMock } from "@backend/test/setup";

import { audit, auditInTransaction } from "../audit";

import type { Logger } from "@jahonbozor/logger";
import type { Token } from "@jahonbozor/schemas";

const mockStaffToken: Token = {
    id: 1,
    type: "staff",
    fullname: "Admin",
    username: "admin",
    roleId: 1,
};

const mockUserToken: Token = {
    id: 42,
    type: "user",
    fullname: "User",
    phone: null,
    telegramId: null,
};

describe("audit", () => {
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    test("should create audit log entry with staff actor", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            { requestId: "req-1", user: mockStaffToken, logger: mockLogger },
            { entityType: "product", entityId: 10, action: "CREATE", newData: { name: "Test" } },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                requestId: "req-1",
                actorId: 1,
                actorType: "STAFF",
                entityType: "product",
                entityId: 10,
                action: "CREATE",
                newData: { name: "Test" },
            }),
        });
        expect(mockLogger.debug).toHaveBeenCalled();
    });

    test("should create audit log entry with user actor", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            { user: mockUserToken, logger: mockLogger },
            { entityType: "order", entityId: 5, action: "CREATE" },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: 42,
                actorType: "USER",
                requestId: null,
            }),
        });
    });

    test("should use SYSTEM actor when no user provided", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            { logger: mockLogger },
            { entityType: "system", entityId: 0, action: "UPDATE" },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: null,
                actorType: "SYSTEM",
            }),
        });
    });

    test("should include metadata when ipAddress or userAgent provided", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            {
                user: mockStaffToken,
                logger: mockLogger,
                ipAddress: "192.168.1.1",
                userAgent: "Mozilla/5.0",
            },
            { entityType: "staff", entityId: 1, action: "LOGIN" },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                metadata: { ipAddress: "192.168.1.1", userAgent: "Mozilla/5.0" },
            }),
        });
    });

    test("should not include metadata when neither ipAddress nor userAgent provided", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            { user: mockStaffToken, logger: mockLogger },
            { entityType: "staff", entityId: 1, action: "LOGIN" },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                metadata: undefined,
            }),
        });
    });

    test("should not throw on database error, just log", async () => {
        prismaMock.auditLog.create.mockRejectedValueOnce(new Error("DB error"));

        await audit(
            { user: mockStaffToken, logger: mockLogger },
            { entityType: "product", entityId: 1, action: "DELETE" },
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
            "AuditLog: Failed to create entry",
            expect.objectContaining({ entityType: "product" }),
        );
    });

    test("should include previousData and newData when provided", async () => {
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await audit(
            { user: mockStaffToken, logger: mockLogger },
            {
                entityType: "product",
                entityId: 1,
                action: "UPDATE",
                previousData: { price: 100 },
                newData: { price: 200 },
            },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                previousData: { price: 100 },
                newData: { price: 200 },
            }),
        });
    });
});

describe("auditInTransaction", () => {
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    test("should create audit log entry via transaction client", async () => {
        // prismaMock acts as the transaction client (same shape)
        prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

        await auditInTransaction(
            prismaMock as never,
            { requestId: "tx-1", user: mockStaffToken, logger: mockLogger },
            { entityType: "order", entityId: 5, action: "CREATE" },
        );

        expect(prismaMock.auditLog.create).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            "AuditLog: Entry created in transaction",
            expect.objectContaining({ entityType: "order" }),
        );
    });

    test("should not throw on transaction error, just log", async () => {
        prismaMock.auditLog.create.mockRejectedValueOnce(new Error("TX error"));

        await auditInTransaction(
            prismaMock as never,
            { user: mockStaffToken, logger: mockLogger },
            { entityType: "order", entityId: 5, action: "DELETE" },
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
            "AuditLog: Failed to create entry in transaction",
            expect.objectContaining({ entityType: "order" }),
        );
    });
});
