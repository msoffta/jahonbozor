# RULES.md

Quick reference for code conventions. See CLAUDE.md for detailed guidance.

## Table of Contents

- [Обязательно](#обязательно)
- [Запрещено](#запрещено)
- [Runtime](#runtime)
- [TypeScript](#typescript)
- [Zod Schemas](#zod-schemas)
- [Naming](#naming)
- [File Structure](#file-structure)
- [Service Pattern](#service-pattern)
- [Route Pattern](#route-pattern)
- [Logging](#logging)
- [Audit Logging](#audit-logging)
- [Transactions](#transactions)
- [Comments](#comments)
- [HTTP Status Codes](#http-status-codes)
- [Permissions](#permissions)
- [Soft Delete](#soft-delete)
- [Category Hierarchy](#category-hierarchy)
- [Enums](#enums)
- [Request Context](#request-context)
- [Unit Testing](#unit-testing)

---

## Обязательно

- **Test First** — сначала пишем/обновляем тесты, затем код. При ревью модуля: сначала проверяем тесты
- **Unit тесты** — при создании/изменении модуля (service + index tests)
- **Обновлять RULES.md** — при изменении паттернов/конвенций
- **Обновлять CLAUDE.md** — при ключевых изменениях (модули, API, конфиги)

## Запрещено

- **DRY (Don't Repeat Yourself)** — предпочитаем явное дублирование кода вместо преждевременных абстракций. Три похожих блока кода лучше, чем одна сложная абстракция

## Runtime

**Bun only** — не используем Node.js, npm, yarn, pnpm

```bash
bun install          # НЕ npm install
bun run dev          # НЕ node/npm run
bun test             # НЕ npm test
bun run typecheck    # Проверка типов
```

## TypeScript

### DO
- Use specific types: `Permission[]` not `string[]`
- Use `unknown` for dynamic data
- Use descriptive names: `tokenRecord`, `staffData`, `existingProduct`
- Export type with schema: `export type X = z.infer<typeof X>`

### DON'T
- Use `any` — use `unknown`
- Use abbreviations: `t`, `u`, `e`, `s`
- Use single letters (except `i` in loops)

## Zod Schemas

### DO
```typescript
z.record(z.string(), z.unknown())     // JSON fields
.nullable()                            // Prisma String?
.nullish()                             // null or undefined
Model.omit({ id, createdAt, updatedAt }) // DTOs from Model
z.coerce.number()                      // Query param coercion
z.discriminatedUnion("type", [...])    // Token: staff vs user
z.enum(ALL_PERMISSIONS)                // Permission enum
```

### DON'T
```typescript
z.record(z.string(), z.any())         // Never use z.any()
.nullable().optional()                 // Use .nullish() instead
```

## Naming

| Pattern | Example |
|---------|---------|
| Service methods | `getAllProducts`, `createProduct`, `deleteProduct` |
| Route params | `productIdParams`, `auditLogIdParams` |
| Snapshots | `createProductSnapshot(product)` |
| Context | `AuditContext`, `staffId`, `requestId` |

## File Structure

```
{domain}/
├── {domain}.index.ts     # Routes (Elysia instance)
└── {domain}.service.ts   # Business logic (abstract class)
```

## Service Pattern

```typescript
export abstract class DomainService {
    static async getAll(params, logger): Promise<ReturnSchema>
    static async getById(id, logger): Promise<ReturnSchema>
    static async create(data, context, logger): Promise<ReturnSchema>
    static async update(id, data, context, logger): Promise<ReturnSchema>
    static async delete(id, context, logger): Promise<ReturnSchema>
}
```

## Route Pattern

```typescript
.post("/", async ({ body, user, set, logger, requestId }): Promise<ReturnSchema> => {
    try {
        const result = await Service.create(body, { staffId: user.id, user, requestId }, logger);
        if (!result.success) set.status = 400;
        return result;
    } catch (error) {
        logger.error("Domain: Unhandled error", { error });
        return { success: false, error };
    }
}, {
    permissions: [Permission.DOMAIN_CREATE],
    body: CreateSchema,
})
```

## Logging

| Level | Use Case | Example |
|-------|----------|---------|
| `error` | System failures | `logger.error("DB: Connection failed", { error })` |
| `warn` | Auth failures, validation | `logger.warn("Auth: Invalid token", { userId })` |
| `info` | Business events | `logger.info("Orders: Completed", { orderId })` |
| `debug` | Dev details | `logger.debug("Request", { body })` |

**Format:** `"Module: Action/Status"` + metadata object

## Audit Logging

### When to Audit
- CREATE, UPDATE, DELETE, RESTORE operations
- LOGIN, LOGOUT events
- Permission changes
- Order status changes
- Inventory adjustments

### AuditContext
```typescript
{ requestId, user, logger, ipAddress?, userAgent? }
```

### Pattern
```typescript
await auditInTransaction(transaction, { requestId, user, logger }, {
    entityType: "product",      // table name
    entityId: product.id,       // record id
    action: "CREATE",           // AuditAction enum
    previousData: snapshot,     // before (optional)
    newData: snapshot,          // after (optional)
});

// Standalone (login/logout)
await audit({ requestId, user, logger }, { ... });
```

## Transactions

### DO
```typescript
await prisma.$transaction(async (transaction) => {
    const record = await transaction.model.create({ data });
    await transaction.history.create({ data: { ... } });
    await auditInTransaction(transaction, context, params);
    return [record];
});
```

### DON'T
```typescript
// Don't mix transaction and non-transaction calls
const record = await prisma.model.create({ data });  // outside
await transaction.history.create({ data });           // inside
```

## Comments

### DO
```typescript
// Token rotation: revoke old token to prevent replay attacks
await Auth.revokeRefreshToken(token);

// Telegram hash validation uses HMAC-SHA256 per official docs
const secretKey = crypto.createHash("sha256")...
```

### DON'T
```typescript
const userId = user.id; // get user id
if (tokenRecord.revoked) { // check if revoked
```

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Success (default) |
| 400 | Validation error, business logic failure |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (no permission) |
| 404 | Resource not found |
| 500 | Internal server error |

## Permissions

Format: `resource:action` or `resource:action:scope`

```typescript
Permission.PRODUCTS_CREATE    // "products:create"
Permission.USERS_READ_OWN     // "users:read:own"
Permission.ORDERS_LIST_ALL    // "orders:list:all"

// Permission groups
PermissionGroups.PRODUCTS_ALL // All product permissions
PermissionGroups.ORDERS_ALL   // All order permissions

// Helpers
hasPermission(perms, required)
hasAnyPermission(perms, required[])
hasAllPermissions(perms, required[])
```

## Soft Delete

```typescript
// Delete
await prisma.model.update({
    where: { id },
    data: { deletedAt: new Date() },
});

// Query active only
where: { deletedAt: null }

// Include deleted
where: includeDeleted ? {} : { deletedAt: null }

// Restore
data: { deletedAt: null }
```

## Category Hierarchy

Self-referencing `parentId` for tree structure:

```typescript
// Root categories
where: { parentId: null }

// Children of category
where: { parentId: categoryId }

// Include relations
include: { parent: true, children: true }

// Query params
?parentId=null          // roots only
?parentId=5             // children of 5
?includeChildren=true   // with children
?depth=3                // recursion depth (max 5)
```

## Enums

```typescript
AuditAction:   CREATE | UPDATE | DELETE | RESTORE | LOGIN | LOGOUT | ...
ActorType:     STAFF | USER | SYSTEM
Operation:     CREATE | UPDATE | DELETE | RESTORE | INVENTORY_ADD | INVENTORY_REMOVE
PaymentType:   CASH | CREDIT_CARD
OrderStatus:   NEW | ACCEPTED
```

## Request Context

Every handler receives `requestId` and `logger` via middleware:

```typescript
.post("/", async ({ body, user, logger, requestId }) => {
    // logger already includes requestId
    // requestId available for audit logging
})
```

### Child Logger
```typescript
const childLogger = createChildLogger(parentLogger, { requestId, userId });
```

## Unit Testing

### File Structure
```
apps/backend/
├── test/
│   └── setup.ts           # Preload with Prisma mocks
├── bunfig.toml            # preload = ["./test/setup.ts"]
└── src/api/{domain}/__tests__/
    ├── {domain}.service.test.ts
    └── {domain}.index.test.ts
```

### Mocking (Bun native)

```typescript
import { mock, spyOn, beforeEach, afterEach } from "bun:test";

// mock() — create mock functions
const mockFn = mock((x: number) => x * 2);
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ id: 1 });
mockFn.mockRejectedValue(new Error("fail"));
expect(mockFn).toHaveBeenCalledWith(5);

// spyOn() — spy on methods
const spy = spyOn(service, "method").mockResolvedValue({});
expect(spy).toHaveBeenCalledTimes(1);

// mock.module() — mock modules
mock.module("@lib/prisma", () => ({ prisma: prismaMock }));

// Cleanup
afterEach(() => {
    mock.restore();        // Restore spyOn
    mock.clearAllMocks();  // Clear history
});
```

### Prisma Mock (test/setup.ts)

Strictly typed mocks using Prisma model types:

```typescript
import type { Users, Staff, ... } from "@generated/prisma/client";

type MockedModel<T> = {
    findUnique: ReturnType<typeof mock<(args: unknown) => Promise<T | null>>>;
    create: ReturnType<typeof mock<(args: unknown) => Promise<T>>>;
    // ...
};

export const prismaMock = {
    users: createModelMock<Users>(),
    staff: createModelMock<Staff>(),
    // ...
};
```

### Type Guards for ReturnSchema

```typescript
import { expectSuccess, expectFailure } from "@test/setup";

// Success — TS knows data exists
const success = expectSuccess(result);
expect(success.data).toEqual(expected);

// Failure — TS knows error exists
const failure = expectFailure(result);
expect(failure.error).toBe("Error");
```

### Service Test Pattern

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@test/setup";
import { Users } from "../users.service";

describe("Users.createUser", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mock.clearAllMocks();
    });

    test("should create user with valid data", async () => {
        // Arrange
        const mockUser = { id: 1, fullname: "John", ... };
        prismaMock.users.create.mockResolvedValue(mockUser);

        // Act
        const result = await Users.createUser({ fullname: "John" }, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual(mockUser);
        expect(prismaMock.users.create).toHaveBeenCalled();
    });

    test("should handle database error", async () => {
        // Arrange
        const dbError = new Error("DB error");
        prismaMock.users.create.mockRejectedValue(dbError);

        // Act
        const result = await Users.createUser({ fullname: "John" }, mockLogger);

        // Assert
        const failure = expectFailure(result);
        expect(failure.error).toBe(dbError);
    });
});
```

### Elysia Test Pattern

```typescript
import { describe, test, expect } from "bun:test";
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

### Test Modifiers

```typescript
test.skip("incomplete", () => {});        // Skip
test.todo("implement later", () => {});   // TODO
test.only("debug this", () => {});        // Only this

test.skipIf(isCI)("slow test", () => {}); // Conditional skip
test.if(isMacOS)("mac only", () => {});   // Conditional run

test("with timeout", () => {}, 10000);    // 10s timeout
test("retry", () => {}, { retry: 3 });    // Up to 3 retries
```

### Parametrized Tests

```typescript
const cases = [
    [1, 2, 3],
    [0, 0, 0],
];

test.each(cases)("add(%i, %i) = %i", (a, b, expected) => {
    expect(a + b).toBe(expected);
});
```

### Test Naming

```typescript
// ✅ Хорошо
test("should return null when user not found", ...);
test("creates user with valid data", ...);

// ❌ Плохо
test("test1", ...);
test("works", ...);
```

### Commands

```bash
# Run from apps/backend/ directory!
cd apps/backend

bun test                          # All tests
bun test --watch                  # Watch mode
bun test --coverage               # With coverage
bun test --bail                   # Stop on first failure
bun test --test-name-pattern "X"  # Filter by name
```

> Tests must run from `apps/backend/` (where bunfig.toml is).

### Test Coverage (обязательно)

Каждый метод должен иметь тесты на:
1. **Happy path** — успешный сценарий
2. **Edge cases** — пустые значения, null, граничные значения
3. **Error cases** — ошибки БД, валидации, 404
4. **Boundary values** — 0, negative, max length, special chars

```typescript
// Минимальный набор для CRUD метода:
test("should succeed with valid data", ...);        // happy path
test("should fail when not found", ...);            // 404
test("should fail when db error", ...);             // error
test("should handle empty/null values", ...);       // edge case
test("should validate input", ...);                 // validation
```

### Checklist

- [ ] Happy path работает
- [ ] Ошибки при невалидных данных
- [ ] Обработка 404 (не найдено)
- [ ] Обработка ошибок БД
- [ ] Граничные значения (0, null, empty, max)
- [ ] Права доступа (если есть)

### DO
- Isolate tests (setup.ts handles `mockReset()` globally)
- Test behavior, not implementation
- Use AAA pattern (Arrange-Act-Assert)
- Group tests with `describe`
- Cover ALL edge cases — they catch real bugs
- Test boundary values (0, negative, max, empty)

### DON'T
- Don't call `mock.clearAllMocks()` in test files — setup.ts already does `mockReset()`
- Don't rely on test execution order
- Don't leave `.only` in commits
- Don't test internal implementation details
- Don't use real external services
- Don't skip edge cases

### Mock Isolation (setup.ts handles this)

```typescript
// mockClear() — clears call history ONLY
// mockReset() — clears history AND mockResolvedValueOnce queue

// setup.ts already does this globally — DON'T duplicate in test files
beforeEach(() => {
    method.mockReset();
    method.mockImplementation(defaultImpl);
});
```
