import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import type { AuditLog, PrismaClient, Users } from "@backend/generated/prisma/client";
import type { Logger } from "@jahonbozor/logger";

// Set env vars before any module imports
process.env.TELEGRAM_BOT_TOKEN ??= "test-token-for-tests";

export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@bot/lib/prisma", () => ({ prisma: prismaMock }));

beforeEach(() => {
    mockReset(prismaMock);
    // Restore $transaction callback mode
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
        if (typeof callback === "function") return callback(prismaMock);
        return Promise.all(callback as Promise<unknown>[]);
    });
});

export const createMockLogger = (): Logger => mockDeep<Logger>();

// Typed mock factories — avoid `as any` in tests
const now = new Date("2024-01-01");

export const mockUser = (overrides: Partial<Users> = {}): Users => ({
    id: 1,
    fullname: "Test User",
    username: "testuser",
    phone: null,
    photo: null,
    telegramId: "123456",
    language: "uz",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
});

export const mockAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
    id: 1,
    requestId: null,
    actorId: 1,
    actorType: "USER",
    entityType: "Users",
    entityId: 1,
    action: "UPDATE",
    previousData: null,
    newData: null,
    metadata: null,
    createdAt: now,
    ...overrides,
});
