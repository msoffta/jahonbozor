import { mock, beforeEach, expect } from "bun:test";
import type { Logger } from "@jahonbozor/logger";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import type {
    Users,
    Staff,
    Role,
    RefreshToken,
    Product,
    Category,
    Order,
    OrderItem,
    ProductHistory,
    AuditLog,
} from "@backend/generated/prisma/client";

// Generic mock type for Prisma model methods
type MockedModel<T> = {
    findUnique: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    findFirst: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    findMany: ReturnType<typeof mock<(args: unknown) => Promise<T[]>>>;
    create: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    createMany: ReturnType<typeof mock<(args: unknown) => Promise<{ count: number }>>>;
    update: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    updateMany: ReturnType<typeof mock<(args: unknown) => Promise<{ count: number }>>>;
    upsert: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    delete: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    deleteMany: ReturnType<typeof mock<(args: unknown) => Promise<{ count: number }>>>;
    count: ReturnType<typeof mock<(args: unknown) => Promise<number>>>;
    aggregate: ReturnType<typeof mock<(args: unknown) => Promise<unknown>>>;
    groupBy: ReturnType<typeof mock<(args: unknown) => Promise<unknown[]>>>;
};

// Factory for creating typed model mock methods
const createModelMock = <T>(): MockedModel<T> => ({
    findUnique: mock(() => Promise.resolve(null)),
    findFirst: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve({} as T)),
    createMany: mock(() => Promise.resolve({ count: 0 })),
    update: mock(() => Promise.resolve({} as T)),
    updateMany: mock(() => Promise.resolve({ count: 0 })),
    upsert: mock(() => Promise.resolve({} as T)),
    delete: mock(() => Promise.resolve({} as T)),
    deleteMany: mock(() => Promise.resolve({ count: 0 })),
    count: mock(() => Promise.resolve(0)),
    aggregate: mock(() => Promise.resolve({})),
    groupBy: mock(() => Promise.resolve([])),
});

// Transaction callback type for proper typing
type TransactionCallback = (tx: unknown) => Promise<unknown>;

// Original $transaction implementation (handles both callback and array modes)
const originalTransaction = async (
    callback: TransactionCallback | Promise<unknown>[],
): Promise<unknown> => {
    if (typeof callback === "function") {
        return callback(prismaMock);
    }
    return Promise.all(callback);
};

// Create Prisma Client mock with strict typing
export const prismaMock = {
    users: createModelMock<Users>(),
    staff: createModelMock<Staff>(),
    role: createModelMock<Role>(),
    refreshToken: createModelMock<RefreshToken>(),
    product: createModelMock<Product>(),
    category: createModelMock<Category>(),
    order: createModelMock<Order>(),
    orderItem: createModelMock<OrderItem>(),
    productHistory: createModelMock<ProductHistory>(),
    auditLog: createModelMock<AuditLog>(),
    $transaction: mock<(callback: TransactionCallback | Promise<unknown>[]) => Promise<unknown>>(
        originalTransaction,
    ),
    $connect: mock(() => Promise.resolve()),
    $disconnect: mock(() => Promise.resolve()),
};

// Mock Prisma module BEFORE it's imported
// Bun resolves @lib/* alias, so we need to mock the resolved path
mock.module("@backend/lib/prisma", () => ({ prisma: prismaMock }));

// Default implementations for model methods
const defaultModelImplementations = {
    findUnique: () => Promise.resolve(null),
    findFirst: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    createMany: () => Promise.resolve({ count: 0 }),
    update: () => Promise.resolve({}),
    updateMany: () => Promise.resolve({ count: 0 }),
    upsert: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
    deleteMany: () => Promise.resolve({ count: 0 }),
    count: () => Promise.resolve(0),
    aggregate: () => Promise.resolve({}),
    groupBy: () => Promise.resolve([]),
};

// Helper to reset model mocks (clear history AND implementations)
const resetModelMocks = <T>(model: MockedModel<T>) => {
    Object.entries(model).forEach(([methodName, method]) => {
        if (typeof method?.mockReset === "function") {
            method.mockReset();
            // Restore default implementation after reset
            const defaultImpl = defaultModelImplementations[methodName as keyof typeof defaultModelImplementations];
            if (defaultImpl) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (method as any).mockImplementation(defaultImpl);
            }
        }
    });
};

// Reset all mocks before each test
beforeEach(() => {
    Object.entries(prismaMock).forEach(([key, value]) => {
        if (key.startsWith("$")) {
            if (typeof (value as { mockReset?: () => void })?.mockReset === "function") {
                (value as { mockReset: () => void }).mockReset();
            }
        } else if (typeof value === "object" && value !== null) {
            resetModelMocks(value as MockedModel<unknown>);
        }
    });

    // Restore original $transaction implementation (handles both callback and array modes)
    // This prevents tests using mockResolvedValue() from affecting subsequent tests
    prismaMock.$transaction.mockImplementation(originalTransaction);
    prismaMock.$connect.mockImplementation(() => Promise.resolve());
    prismaMock.$disconnect.mockImplementation(() => Promise.resolve());
});

// Mock logger factory
export const createMockLogger = (): Logger =>
    ({
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
    }) as unknown as Logger;

// Type guard helpers for ReturnSchema in tests
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
