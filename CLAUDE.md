# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Table of Contents

- [Обязательные правила](#обязательные-правила)
- [Runtime & Package Manager](#runtime--package-manager)
- [Quick Reference](#quick-reference)
- [Architecture](#architecture)
- [Permissions System](#permissions-system)
- [Category Hierarchy](#category-hierarchy)
- [Response Pattern](#response-pattern)
- [Request Context](#request-context)
- [Logging](#logging)
- [Audit Logging](#audit-logging)
- [Enums Reference](#enums-reference)
- [TypeScript Rules](#typescript-rules)
- [HTTP Status Codes](#http-status-codes)
- [Soft Delete Pattern](#soft-delete-pattern)
- [Transaction Pattern](#transaction-pattern)
- [Unit Testing](#unit-testing)
- [Environment Variables](#environment-variables)
- [Database](#database)

---

## Обязательные правила

1. **Test First** — сначала пишем/обновляем тесты, затем код:
   - При создании модуля: сначала тесты service → затем service → затем тесты index → затем index
   - При ревью модуля: сначала проверяем наличие и качество тестов
   - При изменении модуля: сначала обновляем тесты для нового поведения
2. **Unit тесты** — при создании/изменении модуля писать оба типа тестов:
   - `{domain}.service.test.ts` — тесты бизнес-логики
   - `{domain}.index.test.ts` — тесты эндпоинтов
3. **Документация** — при ключевых изменениях обновлять:
   - `CLAUDE.md` — новые модули, API, конфигурации, зависимости
   - `RULES.md` — изменения паттернов, конвенций, best practices
4. **DRY запрещён** — предпочитаем явное дублирование кода вместо преждевременных абстракций. Три похожих блока кода лучше, чем одна сложная абстракция. Не создавать helpers, utilities или абстракции для одноразовых операций

## Runtime & Package Manager

**Bun** — единственный runtime и package manager в проекте.

- **НЕ использовать:** Node.js, npm, yarn, pnpm
- **Использовать:** `bun`, `bun run`, `bun test`, `bun install`

```bash
# ✅ Правильно
bun install
bun run dev
bun test
bun run typecheck      # Проверка типов (tsc --noEmit)

# ❌ Неправильно
npm install
node index.js
yarn add package
npx tsc
```

## Quick Reference

```bash
bun install                # Install dependencies
bun run dev                # Run backend (port 3000)
bun run prisma:generate    # Generate Prisma client
bun run prisma:migrate     # Create and apply migrations
bun run prisma:studio      # Open Prisma Studio GUI
bun run db:up / db:down    # Start/stop PostgreSQL via Docker
bun test                   # Run unit tests
bun test --watch           # Watch mode
bun test --coverage        # With coverage
```

## Architecture

### Monorepo Structure
```
apps/
├── backend/               # Elysia + Prisma + Bun
└── frontend/              # (when available)
packages/
├── schemas/               # Zod validation schemas
└── logger/                # Winston logger factory
```

### Backend Organization
```
apps/backend/src/
├── api/
│   ├── public/            # Unauthenticated endpoints
│   │   ├── auth/          # /api/public/auth/*
│   │   ├── products/      # /api/public/products/*
│   │   └── orders/        # /api/public/orders/*
│   └── private/           # Protected endpoints (JWT required)
│       ├── users/         # /api/private/users/*
│       ├── staff/         # /api/private/staff/*
│       │   └── roles/     # /api/private/staff/roles/* (CRUD ролей)
│       ├── products/      # /api/private/products/*
│       │   └── history/   # /api/private/products/history/*
│       ├── orders/        # /api/private/orders/*
│       ├── categories/    # /api/private/categories/* (hierarchical with parentId)
│       └── audit-logs/    # /api/private/audit-logs/*
├── lib/
│   ├── middleware.ts      # Auth macros (auth, permissions)
│   ├── prisma.ts          # Prisma client (PrismaPg adapter)
│   ├── request-context.ts # RequestId generation + child logger
│   ├── audit.ts           # Audit logging helpers
│   └── logger.ts          # Base logger instance
└── generated/prisma/      # Generated Prisma client + enums
```

### Domain File Pattern
Each domain folder contains:
- `{domain}.index.ts` — Route definitions (Elysia instance)
- `{domain}.service.ts` — Business logic and database queries

### Route Prefix Convention
```typescript
// Hierarchical prefixes — each level adds its segment
app.use(publicRoutes.prefix("/api"))      // base
   .use(privateRoutes.prefix("/api"))

// api/public/index.ts
export const publicRoutes = new Elysia({ prefix: "/public" })

// api/public/auth/auth.index.ts
const auth = new Elysia({ prefix: "/auth" })
    .post("/login", ...)  // → /api/public/auth/login
```

**Resulting paths:**
- Public: `/api/public/{domain}/{endpoint}`
- Private: `/api/private/{domain}/{endpoint}`

## Permissions System

### Format
```typescript
// resource:action or resource:action:scope
Permission.PRODUCTS_CREATE      // "products:create"
Permission.USERS_READ_OWN       // "users:read:own"
Permission.ORDERS_LIST_ALL      // "orders:list:all"
```

### Usage
```typescript
import { Permission, hasPermission } from "@jahonbozor/schemas";

// Route-level (via macro)
.get("/", handler, { permissions: [Permission.PRODUCTS_LIST] })

// Programmatic check
if (hasPermission(userPermissions, Permission.STAFF_READ_ALL)) { ... }
```

### Permission Groups
```typescript
import { PermissionGroups } from "@jahonbozor/schemas";

PermissionGroups.PRODUCTS_ALL   // All product permissions
PermissionGroups.ORDERS_ALL     // All order permissions
// Also: USERS_ALL, STAFF_ALL, ROLES_ALL, CATEGORIES_ALL, etc.
```

### Helper Functions
```typescript
hasPermission(perms, required)           // Direct check
hasPermissionWithScope(perms, r, a, s?)  // Scope-aware (:all covers :own)
hasAnyPermission(perms, required[])      // OR logic
hasAllPermissions(perms, required[])     // AND logic
```

### For Zod Schemas
```typescript
import { ALL_PERMISSIONS } from "@jahonbozor/schemas";
z.enum(ALL_PERMISSIONS)  // Type-safe enum validation
```

## Category Hierarchy

Categories use self-referencing `parentId` for hierarchical structure:

```prisma
model Category {
    id       Int     @id @default(autoincrement())
    name     String
    parentId Int?    // null = root category

    parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
    children Category[] @relation("CategoryHierarchy")
    products Product[]
}
```

### API Endpoints
```
GET  /categories              # List (filter by parentId)
GET  /categories/tree         # Full hierarchy tree
GET  /categories/:id          # Single with parent/children
POST /categories              # Create (parentId in body for subcategory)
```

### Query Parameters
- `parentId=null` — root categories only
- `parentId=5` — children of category 5
- `includeChildren=true` — include child categories
- `includeParent=true` — include parent category
- `depth=3` — recursion depth for children (max 5)

### Hierarchical Product Filter
When filtering products by `categoryId`, all descendant categories are included:
```typescript
// Filter by "Electronics" (id=1) returns products from:
// - Electronics (id=1)
// - Smartphones (id=5, parentId=1)
// - iPhone (id=10, parentId=5)
```

## Response Pattern

All endpoints return `Promise<ReturnSchema>`:

```typescript
import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";

.post("/endpoint", async ({ set, logger }): Promise<ReturnSchema> => {
    try {
        return { success: true, data: { user, token } };
    } catch (error) {
        logger.error("Module: Error description", { error });
        return { success: false, error };
    }
}, { body: Schema })

// With HTTP status codes
set.status = 401;
return { success: false, error: "Unauthorized" };
```

## Request Context

Every request has `requestId` and `logger` available via middleware:

```typescript
.post("/", async ({ body, user, logger, requestId }): Promise<ReturnSchema> => {
    // logger already includes requestId context
    // requestId available for audit logging
})
```

## Logging

```typescript
import { createLogger, createChildLogger } from "@jahonbozor/logger";
const logger = createLogger("ServiceName");

logger.error("Module: System failure", { error });           // Unrecoverable
logger.warn("Module: Auth failed", { username });            // Recoverable
logger.info("Module: Order completed", { orderId });         // Business events
logger.debug("Module: Request payload", { body });           // Dev details
```

### Child Logger (Request-Scoped)
```typescript
// Automatically provided via requestContext middleware
.post("/", async ({ logger, requestId }) => {
    // logger already includes requestId in metadata
    logger.info("Products: Created", { productId });
});

// Manual creation
const childLogger = createChildLogger(parentLogger, { requestId, userId });
```

**Conventions:**
- Prefix with module name: `"Products: Error message"`
- Include context: `{ userId, orderId, error }`
- Use request-scoped logger for traceability

## Audit Logging

Tracks all data mutations with `requestId`, actor info, and before/after snapshots.

```typescript
import { auditInTransaction, audit } from "@lib/audit";

// Inside transactions (preferred)
await prisma.$transaction(async (transaction) => {
    const product = await transaction.product.create({ data });

    await auditInTransaction(transaction, { requestId, user, logger }, {
        entityType: "product",
        entityId: product.id,
        action: "CREATE",
        newData: createProductSnapshot(product),
    });
});

// Standalone (login/logout)
await audit({ requestId, user, logger }, {
    entityType: "staff",
    entityId: staff.id,
    action: "LOGIN",
});
```

### Service Integration

```typescript
interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

// Service method signature
static async createProduct(
    data: CreateProductBody,
    context: AuditContext,
    logger: Logger,
): Promise<ReturnSchema>

// Route handler
.post("/", async ({ body, user, logger, requestId }) => {
    return await ProductsService.createProduct(
        body,
        { staffId: user.id, user, requestId },
        logger,
    );
})
```

### AuditAction Types
`CREATE`, `UPDATE`, `DELETE`, `RESTORE`, `LOGIN`, `LOGOUT`, `PASSWORD_CHANGE`, `PERMISSION_CHANGE`, `ORDER_STATUS_CHANGE`, `INVENTORY_ADJUST`

### AuditContext Interface
```typescript
interface AuditContext {
    requestId?: string;
    user?: Token;
    logger: Logger;
    ipAddress?: string;
    userAgent?: string;
}
```

### Viewing Audit Logs
- `GET /api/private/audit-logs` — list with filters
- `GET /api/private/audit-logs/:id` — single entry
- `GET /api/private/audit-logs/by-request/:requestId` — all entries for request
- `GET /api/private/audit-logs/by-entity/:entityType/:entityId` — entity history

## Enums Reference

### From Prisma (`@generated/prisma/enums`)
```typescript
AuditAction: CREATE | UPDATE | DELETE | RESTORE | LOGIN | LOGOUT |
             PASSWORD_CHANGE | PERMISSION_CHANGE | ORDER_STATUS_CHANGE | INVENTORY_ADJUST
ActorType:   STAFF | USER | SYSTEM
Operation:   CREATE | UPDATE | DELETE | RESTORE | INVENTORY_ADD | INVENTORY_REMOVE
PaymentType: CASH | CREDIT_CARD
OrderStatus: NEW | ACCEPTED
```

### From Schemas (`@jahonbozor/schemas`)
Same enums available via Zod schemas for validation.

## TypeScript Rules

### Strict Typing
```typescript
// BAD
const permissions: string[] = ["users:create"];
z.enum(values as [string, ...string[]]);

// GOOD
const permissions: Permission[] = [Permission.USERS_CREATE];
z.enum(ALL_PERMISSIONS);
```

### Zod Schemas
- Export schema and type: `export type X = z.infer<typeof X>`
- Use `.nullable()` for Prisma `String?`
- Use `.nullish()` instead of `.nullable().optional()`
- Derive DTOs from Model: `Model.omit({ id, createdAt, updatedAt })`
- **Never use `z.any()`** — use `z.unknown()`

```typescript
// JSON fields
z.record(z.string(), z.unknown())

// Type coercion (query params)
z.coerce.number()
z.coerce.boolean()
z.coerce.date()

// Discriminated unions (Token: staff vs user)
z.discriminatedUnion("type", [TokenStaff, TokenUser])

// Enum from Permission object
z.enum(ALL_PERMISSIONS)
```

### Naming
```typescript
// BAD
const t = await prisma.refreshToken.findUnique(...);
users.map(u => u.id);

// GOOD
const tokenRecord = await prisma.refreshToken.findUnique(...);
users.map(user => user.id);
```

### Comments
- Comment **why**, not what
- No obvious comments (`// get user id`)
- Document: business logic, workarounds, security decisions

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200  | Success (default) |
| 400  | Validation error, business logic failure |
| 401  | Unauthorized (no/invalid token) |
| 403  | Forbidden (no permission) |
| 404  | Resource not found |

```typescript
set.status = 401;
return { success: false, error: "Unauthorized" };
```

## Soft Delete Pattern

Products use `deletedAt` timestamp for logical deletion:

```typescript
// Delete
await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
});

// Query active only
where: { deletedAt: null }

// Include deleted (via query param)
where: includeDeleted ? {} : { deletedAt: null }

// Restore
data: { deletedAt: null }
```

## Transaction Pattern

Use `prisma.$transaction()` for multi-step operations:

```typescript
const [result] = await prisma.$transaction(async (transaction) => {
    // 1. Main operation
    const record = await transaction.model.create({ data });

    // 2. History tracking (if applicable)
    await transaction.productHistory.create({
        data: { productId: record.id, operation: "CREATE", ... }
    });

    // 3. Audit logging
    await auditInTransaction(transaction, context, {
        entityType: "model",
        entityId: record.id,
        action: "CREATE",
        newData: createSnapshot(record),
    });

    return [record];  // Return as array for consistency
});
```

**Rules:**
- All related operations inside same transaction
- Audit logging inside transaction (via `auditInTransaction`)
- History records inside transaction
- Return array from transaction

## Unit Testing

### Quick Commands
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

### Test Structure
```
apps/backend/
├── test/
│   └── setup.ts              # Preload file with Prisma mocks
├── bunfig.toml               # Test configuration
└── src/api/{domain}/__tests__/
    ├── {domain}.service.test.ts  # Service tests
    └── {domain}.index.test.ts    # Endpoint tests
```

### Mocking with Bun (Native)

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

### Prisma Mocking

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

### Mock Isolation (IMPORTANT)

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

### Testing Elysia Endpoints

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

### Test Structure (AAA Pattern)

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

### Test Modifiers

```typescript
test.skip("incomplete", () => {});        // Skip test
test.todo("implement later", () => {});   // Mark as TODO
test.only("debug this", () => {});        // Run only this test

test.skipIf(isCI)("slow", () => {});      // Conditional skip
test.if(isMacOS)("mac only", () => {});   // Conditional run

test("timeout", () => {}, 10000);         // 10s timeout
test("retry", () => {}, { retry: 3 });    // Retry up to 3 times
```

### Parameterized Tests

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

### Test Coverage Requirements

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

### Checklist для каждого метода

При написании тестов проверь:
- [ ] Успешный сценарий работает
- [ ] Возвращает ошибку при невалидных данных
- [ ] Обрабатывает отсутствующие записи (404)
- [ ] Обрабатывает ошибки БД
- [ ] Проверяет граничные значения (0, null, empty, max)
- [ ] Проверяет права доступа (если применимо)
- [ ] Логирует ошибки корректно

### Best Practices

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

### Note: $transaction Mock

`prismaMock.$transaction` supports both modes:
- **Callback**: `prisma.$transaction(async (tx) => { ... })`
- **Array**: `prisma.$transaction([promise1, promise2])`

The `test/setup.ts` automatically restores the original implementation in `beforeEach`, so tests using `mockResolvedValue()` for array-based transactions don't affect subsequent tests.

### Strict Typing for Mocks

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

### Type Guards for ReturnSchema

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

### Mock Logger

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

## Environment Variables

Copy `.env.example` to `.env` in root directory:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Authentication token secret
- `TELEGRAM_BOT_TOKEN` — Telegram auth validation
- `PORT` — Server port (default: 3000)
- `NODE_ENV` — `development` | `production`
- `LOG_LEVEL` — `error` | `warn` | `info` | `debug`

## Database

PostgreSQL via Docker Compose with Prisma ORM.
- Schema: `apps/backend/prisma/schema.prisma`
- Models: `apps/backend/prisma/models/*.prisma`
- Generated: `apps/backend/src/generated/prisma`
- Timezone: Asia/Tashkent

### Prisma Models
| Model | Purpose |
|-------|---------|
| Staff | Employee accounts with roles |
| Users | Customer accounts (Telegram auth) |
| Role | Permission groups for staff |
| RefreshToken | JWT refresh tokens (staff & users) |
| Product | Catalog items (soft delete) |
| Category | Hierarchical categories (self-reference via parentId) |
| ProductHistory | Product change tracking |
| Order | Customer orders |
| OrderItem | Order line items |
| AuditLog | System-wide audit trail |

## Quick Reference

See [RULES.md](RULES.md) for condensed code conventions.
