# Backend Unit Testing

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Quick Commands
```bash
# IMPORTANT: Run from apps/backend directory!
cd apps/backend

bun test                          # Run all tests
bun test --watch                  # Watch mode
bun test --coverage               # With coverage report
bun test --bail                   # Stop after first failure
bun test --test-name-pattern "X"  # Filter by test name
```

> **Note:** Tests must be run from `apps/backend/` directory where `bunfig.toml` is located. Running from monorepo root will skip the preload and mocks won't work.

## Test Structure
```
apps/backend/
├── test/
│   └── setup.ts              # Preload file with Prisma mocks
├── bunfig.toml               # Test configuration
└── src/api/{domain}/__tests__/
    ├── {domain}.service.test.ts  # Service tests
    └── {domain}.index.test.ts    # Endpoint tests
```

## Mocking with Bun (Native)

```typescript
import { mock, spyOn, beforeEach, afterEach } from "bun:test";

// mock() — create mock functions
const mockFn = mock((x: number) => x * 2);
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ id: 1 });
mockFn.mockRejectedValue(new Error("fail"));

// spyOn() — spy on object methods
const spy = spyOn(service, "method").mockResolvedValue({});

// mock.module() — mock modules
mock.module("@lib/prisma", () => ({ prisma: prismaMock }));

// Cleanup
afterEach(() => {
    mock.restore();        // Restore spyOn
    mock.clearAllMocks();  // Clear history
});
```

## Prisma Mocking

Mocks are automatically loaded via `bunfig.toml` preload:

```typescript
// In test files
import { prismaMock, createMockLogger } from "@test/setup";

const mockLogger = createMockLogger();

describe("Users.createUser", () => {
    test("should create user", async () => {
        prismaMock.users.create.mockResolvedValue({ id: 1, name: "John" });

        const result = await Users.createUser({ name: "John" }, mockLogger);

        expect(result.success).toBe(true);
        expect(prismaMock.users.create).toHaveBeenCalled();
    });
});
```

## Mock Isolation (IMPORTANT)

**`mockClear()` vs `mockReset()`:**
- `mockClear()` — clears call history ONLY (calls count, arguments)
- `mockReset()` — clears history AND `mockResolvedValueOnce` queue

**Problem:** If a test sets `mockResolvedValueOnce(value)` and doesn't consume it (e.g., errors early), that value stays in queue for the next test, causing unpredictable failures.

**Solution in `test/setup.ts`:**
```typescript
beforeEach(() => {
    method.mockReset();  // Clear BOTH history and queue
    method.mockImplementation(defaultImpl);  // Restore default
});
```

**Rules:**
- `setup.ts` handles mock reset globally — DON'T duplicate in test files
- DON'T call `mock.clearAllMocks()` in test `beforeEach` — it's redundant
- Test files should only create `mockLogger` and set up test-specific data in `beforeEach`

## Testing Elysia Endpoints

```typescript
import { Elysia } from "elysia";
import { users } from "../users.index";

describe("Users API", () => {
    const app = new Elysia().use(users);

    test("GET /users", async () => {
        // URL must be fully qualified!
        const response = await app.handle(
            new Request("http://localhost/users")
        );

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
test.skip("incomplete", () => {});        // Skip test
test.todo("implement later", () => {});   // Mark as TODO
test.only("debug this", () => {});        // Run only this test

test.skipIf(isCI)("slow", () => {});      // Conditional skip
test.if(isMacOS)("mac only", () => {});   // Conditional run

test("timeout", () => {}, 10000);         // 10s timeout
test("retry", () => {}, { retry: 3 });    // Retry up to 3 times
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
- Isolate tests (`beforeEach` + `mock.clearAllMocks()`)
- Test behavior, not implementation
- Use AAA pattern (Arrange-Act-Assert)
- Group related tests with `describe`
- Use descriptive test names: `"should return null when user not found"`
- Cover ALL edge cases and error scenarios
- Test boundary values (0, negative, max, empty)

**DON'T:**
- Don't rely on test execution order
- Don't leave `.only` in commits
- Don't test internal implementation details
- Don't use real external services
- Don't skip edge cases — they catch real bugs

## Note: $transaction Mock

`prismaMock.$transaction` supports both modes:
- **Callback**: `prisma.$transaction(async (tx) => { ... })`
- **Array**: `prisma.$transaction([promise1, promise2])`

The `test/setup.ts` automatically restores the original implementation in `beforeEach`, so tests using `mockResolvedValue()` for array-based transactions don't affect subsequent tests.

## Strict Typing for Mocks

Prisma mocks use generics with model types from `@generated/prisma/client`:

```typescript
// test/setup.ts
import type { Users, Staff, ... } from "@generated/prisma/client";

type MockedModel<T> = {
    findUnique: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    create: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    // ...
};

const createModelMock = <T>(): MockedModel<T> => ({...});

export const prismaMock = {
    users: createModelMock<Users>(),
    staff: createModelMock<Staff>(),
    // ...
};
```

## Type Guards for ReturnSchema

`ReturnSchema` — discriminated union, `expect()` не сужает типы. Используй helpers из setup:

```typescript
import { expectSuccess, expectFailure } from "@test/setup";

// Success case
const success = expectSuccess(result);
expect(success.data).toEqual(expected);  // TS knows data exists

// Failure case
const failure = expectFailure(result);
expect(failure.error).toBe("Error");     // TS knows error exists
```

## Mock Logger

`createMockLogger()` возвращает typed mock, но Winston `Logger` имеет 100+ свойств. Используем `as unknown as Logger` **только** в setup.ts:

```typescript
export const createMockLogger = (): Logger =>
    ({
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
    }) as unknown as Logger;
```
