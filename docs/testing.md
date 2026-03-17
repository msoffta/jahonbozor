# Backend Unit Testing

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Quick Commands

```bash
bun run test:backend                 # Run all backend tests
bun run test:backend -- --watch      # Watch mode
bun run test:backend -- --coverage   # With coverage report
```

## Test Structure

```
apps/backend/
├── test/
│   └── setup.ts              # Setup file with Prisma mockDeep
├── vitest.config.ts           # Vitest configuration
└── src/api/{domain}/__tests__/
    ├── {domain}.service.test.ts  # Service tests
    └── {domain}.index.test.ts    # Endpoint tests
```

## Mocking with Vitest

```typescript
import { vi, describe, test, expect, beforeEach } from "vitest";

// vi.fn() — create mock functions
const mockFn = vi.fn((x: number) => x * 2);
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ id: 1 });
mockFn.mockRejectedValue(new Error("fail"));

// vi.spyOn() — spy on object methods
const spy = vi.spyOn(service, "method").mockResolvedValue({});

// vi.mock() — mock modules (hoisted automatically, order doesn't matter)
vi.mock("@backend/lib/prisma", () => ({ prisma: prismaMock }));

// Cleanup — automatic with mockReset: true in vitest.config.ts
```

### Key Differences from Bun test

| Bun test            | Vitest                 | Benefit                                        |
| ------------------- | ---------------------- | ---------------------------------------------- |
| `mock()`            | `vi.fn()`              | Same API                                       |
| `mock.module()`     | `vi.mock()`            | **Hoisted automatically** — no import ordering |
| `spyOn()`           | `vi.spyOn()`           | Same API                                       |
| `mock.restore()`    | `vi.restoreAllMocks()` | Configurable in vitest.config.ts               |
| Global module cache | Per-file isolation     | **Mocks don't leak between files**             |

## Prisma Mocking with mockDeep

Type-safe Prisma mocks using `vitest-mock-extended`:

```typescript
// test/setup.ts
import { vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@backend/generated/prisma/client";
import type { Logger } from "@jahonbozor/logger";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";

// Type-safe Prisma mock — all models and methods auto-generated
export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@backend/lib/prisma", () => ({ prisma: prismaMock }));

// Mock Bun's password module (used in auth.service.ts)
vi.mock("bun", () => ({
    password: {
        verify: vi.fn(() => Promise.resolve(false)),
        hash: vi.fn(() => Promise.resolve("$argon2id$mocked")),
    },
}));

// Reset mocks before each test
beforeEach(() => {
    mockReset(prismaMock);
    // Restore $transaction callback mode
    prismaMock.$transaction.mockImplementation(async (callback) => {
        if (typeof callback === "function") return callback(prismaMock);
        return Promise.all(callback as Promise<unknown>[]);
    });
});

// Type-safe logger mock
export const createMockLogger = () => mockDeep<Logger>();

// Type guard helpers for ReturnSchema
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
```

### Type-Safe Mock Usage

```typescript
// TypeScript ENFORCES all required fields — no more `as any`:
prismaMock.users.create.mockResolvedValue({
    id: 1,
    fullname: "John",
    phone: "+998901234567",
    telegramId: "12345",
    language: "uz",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
});

// Partial objects are caught at compile time:
prismaMock.users.create.mockResolvedValue({ id: 1 });
// ❌ TypeScript Error: missing required properties
```

> **Note:** `mockDeep<Logger>()` replaces `as unknown as Logger` — all 100+ Logger properties are auto-mocked.

## Mock Isolation (Automatic)

Vitest isolates mocks per-file automatically. `vi.mock()` in file A does **not** affect file B.

- No centralized mock files needed for isolation
- No manual `mockReset()` between tests — configured in `vitest.config.ts`: `mockReset: true`
- `beforeEach` in `test/setup.ts` resets Prisma mock and restores `$transaction`

## Testing Elysia Endpoints

Elysia's `app.handle()` uses Web Standard `Request`/`Response` API — works under Vitest:

```typescript
import { describe, test, expect } from "vitest";
import { Elysia } from "elysia";
import { users } from "../users.index";

describe("Users API", () => {
    const app = new Elysia().use(users);

    test("GET /users", async () => {
        // URL must be fully qualified!
        const response = await app.handle(new Request("http://localhost/users"));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
    });
});
```

## Test Structure (AAA Pattern)

```typescript
test("should calculate total correctly", () => {
    // Arrange — setup data and mocks
    const items = [{ price: 100, quantity: 2 }];

    // Act — execute the action
    const total = calculateTotal(items);

    // Assert — verify the result
    expect(total).toBe(200);
});
```

## Test Modifiers

```typescript
test.skip("incomplete", () => {}); // Skip test
test.todo("implement later"); // Mark as TODO
test.only("debug this", () => {}); // Run only this test

test("timeout", () => {}, { timeout: 10000 }); // 10s timeout
test("retry", () => {}, { retry: 3 }); // Retry up to 3 times
```

## Parameterized Tests

```typescript
const cases = [
    [1, 2, 3],
    [0, 0, 0],
    [-1, 1, 0],
];

test.each(cases)("add(%i, %i) = %i", (a, b, expected) => {
    expect(a + b).toBe(expected);
});
```

## Test Coverage Requirements

Каждый тест должен покрывать **все** сценарии:

**1. Happy Path (основной сценарий)**

```typescript
test("should create user with valid data", async () => { ... });
test("should return product by id", async () => { ... });
```

**2. Edge Cases (граничные случаи)**

```typescript
test("should handle empty array", async () => { ... });
test("should handle maximum allowed value", async () => { ... });
test("should handle minimum allowed value", async () => { ... });
test("should handle null/undefined optional fields", async () => { ... });
test("should handle whitespace-only strings", async () => { ... });
```

**3. Error Cases (ошибки)**

```typescript
test("should return error when user not found", async () => { ... });
test("should return error when database fails", async () => { ... });
test("should return error when validation fails", async () => { ... });
test("should return 401 when token invalid", async () => { ... });
test("should return 403 when permission denied", async () => { ... });
```

**4. Boundary Conditions (пограничные значения)**

```typescript
test("should handle id = 0", async () => { ... });
test("should handle negative id", async () => { ... });
test("should handle very long string (max length)", async () => { ... });
test("should handle special characters in input", async () => { ... });
```

**5. State Transitions (изменения состояния)**

```typescript
test("should handle already deleted record", async () => { ... });
test("should handle concurrent updates", async () => { ... });
test("should handle restore of active record", async () => { ... });
```

## Checklist для каждого метода

При написании тестов проверь:

- [ ] Успешный сценарий работает
- [ ] Возвращает ошибку при невалидных данных
- [ ] Обрабатывает отсутствующие записи (404)
- [ ] Обрабатывает ошибки БД
- [ ] Проверяет граничные значения (0, null, empty, max)
- [ ] Проверяет права доступа (если применимо)
- [ ] Логирует ошибки корректно

## Best Practices

**DO:**

- Test behavior, not implementation
- Use AAA pattern (Arrange-Act-Assert)
- Group related tests with `describe`
- Use descriptive test names: `"should return null when user not found"`
- Cover ALL edge cases and error scenarios
- Test boundary values (0, negative, max, empty)
- Use `mockDeep` for type-safe mocks

**DON'T:**

- Don't rely on test execution order
- Don't leave `.only` in commits
- Don't test internal implementation details
- Don't use real external services
- Don't skip edge cases — they catch real bugs
- Don't use `as any` in mock return values — use full objects with `mockDeep`

## Note: $transaction Mock

`prismaMock.$transaction` supports both modes:

- **Callback**: `prisma.$transaction(async (tx) => { ... })`
- **Array**: `prisma.$transaction([promise1, promise2])`

The `test/setup.ts` automatically restores the callback implementation in `beforeEach`, so tests using `mockResolvedValue()` for array-based transactions don't affect subsequent tests.

## Type Guards for ReturnSchema

`ReturnSchema` — discriminated union, `expect()` не сужает типы. Используй helpers из setup:

```typescript
import { expectSuccess, expectFailure } from "@backend/test/setup";

// Success case
const success = expectSuccess(result);
expect(success.data).toEqual(expected); // TS knows data exists

// Failure case
const failure = expectFailure(result);
expect(failure.error).toBe("Error"); // TS knows error exists
```

## Testing Elysia Error Responses

### Validation Errors (Zod Schema Failures)

Elysia returns HTTP 422 when request body/params/query fail schema validation:

```typescript
test("should return 422 for invalid body", async () => {
    const response = await app.handle(
        new Request("http://localhost/api/private/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${validToken}`,
            },
            body: JSON.stringify({ name: "" }), // fails min length
        }),
    );
    expect(response.status).toBe(422);
});
```

### Testing status() from Auth Middleware

When `authMiddleware` returns `status(401)` or `status(403)`, test the response directly:

```typescript
test("should return 401 without bearer token", async () => {
    const response = await app.handle(new Request("http://localhost/api/private/products"));
    expect(response.status).toBe(401);
});

test("should return 403 with insufficient permissions", async () => {
    const response = await app.handle(
        new Request("http://localhost/api/private/products", {
            headers: {
                Authorization: `Bearer ${tokenWithoutPermissions}`,
            },
        }),
    );
    expect(response.status).toBe(403);
});
```

### Testing onError Hook Behavior

The global `onError` hook in `index.ts` handles uncaught exceptions. In endpoint tests, verify that:

- `VALIDATION` errors (422) are returned to the client properly
- `NOT_FOUND` (404) is silently ignored in logs
- Unhandled errors are caught and logged as `error` level
