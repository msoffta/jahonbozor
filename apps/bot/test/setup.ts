import { mock, beforeEach } from "bun:test";
import type { Logger } from "@jahonbozor/logger";
import type { Users } from "@backend/generated/prisma/client";

// Set env vars before any module imports
process.env.TELEGRAM_BOT_TOKEN ??= "test-token-for-tests";

// Generic mock type for Prisma model methods
type MockedModel<T> = {
    findUnique: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    findFirst: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    findMany: ReturnType<typeof mock<(args: unknown) => Promise<T[]>>>;
    create: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    update: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    delete: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    count: ReturnType<typeof mock<(args: unknown) => Promise<number>>>;
};

const createModelMock = <T>(): MockedModel<T> => ({
    findUnique: mock(() => Promise.resolve(null)),
    findFirst: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve({} as T)),
    update: mock(() => Promise.resolve({} as T)),
    delete: mock(() => Promise.resolve({} as T)),
    count: mock(() => Promise.resolve(0)),
});

const defaultModelImplementations = {
    findUnique: () => Promise.resolve(null),
    findFirst: () => Promise.resolve(null),
    findMany: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
    count: () => Promise.resolve(0),
};

const resetModelMocks = <T>(model: MockedModel<T>) => {
    Object.entries(model).forEach(([methodName, method]) => {
        if (typeof method?.mockReset === "function") {
            method.mockReset();
            const defaultImpl = defaultModelImplementations[methodName as keyof typeof defaultModelImplementations];
            if (defaultImpl) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (method as any).mockImplementation(defaultImpl);
            }
        }
    });
};

export const prismaMock = {
    users: createModelMock<Users>(),
    $connect: mock(() => Promise.resolve()),
    $disconnect: mock(() => Promise.resolve()),
};

mock.module("@bot/lib/prisma", () => ({ prisma: prismaMock }));

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

    prismaMock.$connect.mockImplementation(() => Promise.resolve());
    prismaMock.$disconnect.mockImplementation(() => Promise.resolve());
});

export const createMockLogger = (): Logger =>
    ({
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
    }) as unknown as Logger;
