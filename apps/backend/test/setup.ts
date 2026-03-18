import { beforeEach, expect, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import type { PrismaClient } from "@backend/generated/prisma/client";
import type { Logger } from "@jahonbozor/logger";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";

// Type-safe Prisma mock — все модели и методы auto-mocked
export const prismaMock = mockDeep<PrismaClient>();

// Mock @backend/lib/prisma модуль ПЕРЕД импортами
vi.mock("@backend/lib/prisma", () => ({
    prisma: prismaMock,
}));

// Mock Bun's password модуль (используется в auth.service.ts + staff.service.ts)
vi.mock("bun", () => ({
    password: {
        verify: vi.fn(() => Promise.resolve(false)),
        hash: vi.fn(() => Promise.resolve("$argon2id$mocked")),
    },
}));

// Reset все моки перед каждым тестом
beforeEach(() => {
    mockReset(prismaMock);

    // Восстановить $transaction callback mode (обрабатывает callback и array)
    prismaMock.$transaction.mockImplementation(async (callback) => {
        if (typeof callback === "function") {
            return callback(prismaMock);
        }
        return Promise.all(callback as Promise<unknown>[]);
    });
});

// Mock logger factory — type-safe с mockDeep
export const createMockLogger = (): Logger => mockDeep<Logger>();

// Type guard helpers для ReturnSchema тестов
export const expectSuccess = (result: ReturnSchema) => {
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    return result;
};

export const expectFailure = (result: ReturnSchema) => {
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected failure");
    return result;
};
