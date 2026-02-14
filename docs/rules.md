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
- [Frontend File Naming](#frontend-file-naming)
- [Frontend Component Pattern](#frontend-component-pattern)
- [Frontend Route Pattern](#frontend-route-pattern)
- [Frontend State Management](#frontend-state-management)
- [Frontend API Layer](#frontend-api-layer)
- [Frontend Forms](#frontend-forms)
- [Frontend i18n](#frontend-i18n)
- [Frontend Import Order](#frontend-import-order)
- [Frontend Tailwind](#frontend-tailwind)
- [Frontend Testing](#frontend-testing)

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

---

# Frontend

## Frontend File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | `kebab-case.tsx` | `product-form.tsx` |
| Stores | `{domain}.store.ts` | `auth.store.ts`, `ui.store.ts` |
| API files | `{domain}.api.ts` | `products.api.ts` |
| Route files | TanStack convention | `$productId.tsx`, `_dashboard.tsx` |
| Tests | `{name}.test.ts(x)` | `product-form.test.tsx` |
| i18n | `{namespace}.json` | `products.json`, `common.json` |
| Hooks | `use-{name}.ts` | `use-permissions.ts` |

### Frontend Domain Structure

```
components/{domain}/
├── {domain}-form.tsx          # Create/edit form
├── {domain}-table.tsx         # TanStack Table
└── {domain}-columns.tsx       # Column definitions

api/
└── {domain}.api.ts            # Query keys + queryOptions + useMutation hooks
```

## Frontend Component Pattern

```typescript
// Named exports only — no default exports
export function ProductForm({ defaultValues, onSubmit, isLoading }: ProductFormProps) {
    // 1. Hooks (useTranslation, useForm, useQuery)
    const { t } = useTranslation("products");

    // 2. Derived state
    const isEditing = defaultValues !== undefined;

    // 3. Handlers
    function handleSubmit(data: CreateProductBodyType) { ... }

    // 4. Render
    return ( ... );
}
```

### DO
- Named exports, no default exports
- Hooks first, then derived state, then handlers, then render
- Descriptive prop interfaces
- Use `useTranslation()` for all user-facing text

### DON'T
- No default exports
- No inline styles (`style={}`)
- No business logic in components — delegate to hooks/api layer
- No direct `fetch()` calls — use `apiClient`

## Frontend Route Pattern

### Layout Routes (TanStack Router)

```
_auth.tsx          → Unauthenticated layout (login page)
_dashboard.tsx     → Authenticated layout (sidebar + header)
_public.tsx        → Public layout (user app: navbar + footer)
_user.tsx          → Authenticated user layout
```

### Protected Route

```typescript
export const Route = createFileRoute("/_dashboard")({
    beforeLoad: async () => {
        const { token } = useAuthStore.getState();
        if (!token) throw redirect({ to: "/login" });
    },
    component: DashboardLayout,
});
```

### Permission Guard

```typescript
export const Route = createFileRoute("/_dashboard/staff/")({
    beforeLoad: () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.STAFF_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: StaffListPage,
});
```

### Data Loading Route

```typescript
export const Route = createFileRoute("/_dashboard/products/")({
    validateSearch: (search) => ProductsPagination.parse(search),
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }) => {
        context.queryClient.ensureQueryData(productsListOptions(deps));
    },
    component: ProductsListPage,
});
```

## Frontend State Management

### Rules
- **Zustand** = client state (auth, UI preferences, cart)
- **TanStack Query** = server state (products, orders, etc.)
- **Never** store server data in Zustand
- **Never** duplicate TanStack Query cache in Zustand
- Use `persist` only for UI preferences and cart

### Zustand Store

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";  // only when needed

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    permissions: [],
    isAuthenticated: false,
    setAuth: (token, user, permissions) =>
        set({ token, user, permissions, isAuthenticated: true }),
    clearAuth: () =>
        set({ token: null, user: null, permissions: [], isAuthenticated: false }),
}));
```

### TanStack Query Keys

```typescript
export const productKeys = {
    all: ["products"] as const,
    lists: () => [...productKeys.all, "list"] as const,
    list: (params) => [...productKeys.lists(), params] as const,
    details: () => [...productKeys.all, "detail"] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
};
```

### Mutation + Invalidation

```typescript
export function useCreateProduct() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data) => apiClient.post("/api/private/products", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.lists() });
        },
    });
}
```

## Frontend API Layer

### Elysia Eden (Treaty)

```typescript
import { api } from "@/lib/api-client";

// Fully typed — autocomplete for paths and params
const { data } = await api.api.public.products.get({ query: { page: 1 } });
const { data } = await api.api.private.products.post({ name: "Product" });
const { data } = await api.api.private.products({ id: 1 }).get();

// Auth header injected automatically from useAuthStore
// 401 → auto-refresh or logout
// Uses credentials: "include" for httpOnly cookies
```

### API File Pattern

```typescript
// api/{domain}.api.ts
export const domainKeys = { ... };                    // Query key factory
export const domainListOptions = (params) => ...;     // queryOptions
export const domainDetailOptions = (id) => ...;       // queryOptions
export function useCreateDomain() { ... }             // useMutation
export function useUpdateDomain(id) { ... }           // useMutation
export function useDeleteDomain() { ... }             // useMutation
```

### Vite Proxy (dev)

```typescript
// vite.config.ts — proxy /api to backend
server: {
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } }
}
```

## Frontend Forms

```typescript
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { CreateProductBody } from "@jahonbozor/schemas/src/products";

const form = useForm({
    defaultValues: { name: "", price: 0, ... },
    onSubmit: async ({ value }) => onSubmit(value),
    validatorAdapter: zodValidator(),
});

// Per-field validation
<form.Field
    name="name"
    validators={{ onChange: CreateProductBody.shape.name }}
    children={(field) => ( ... )}
/>
```

### Rules
- Use `zodValidator()` adapter with schemas from `@jahonbozor/schemas`
- Per-field validation via `validators.onChange` with Zod shape
- Accept `defaultValues`, `onSubmit`, `isLoading` as props
- All labels via `useTranslation()`

## Frontend i18n

### Languages
- **uz** — Uzbek (default, fallback)
- **ru** — Russian

### Structure

```
i18n/
├── config.ts          # i18next init
├── uz/
│   ├── common.json    # Shared: save, cancel, delete, search, loading
│   ├── auth.json      # Login page labels
│   ├── products.json  # Product-specific
│   └── ...per domain
└── ru/
    └── ...same structure
```

### Usage

```typescript
const { t } = useTranslation("products");
t("title")         // "Mahsulotlar"
t("common:save")   // Cross-namespace access
```

### Language Switch

```typescript
const locale = useUIStore((state) => state.locale);
useEffect(() => { i18n.changeLanguage(locale); }, [locale]);
```

## Frontend Import Order

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. Third-party
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

// 3. @jahonbozor/* packages
import { Permission } from "@jahonbozor/schemas";
import { Button, Input } from "@jahonbozor/ui";

// 4. Internal (@/ alias)
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

// 5. Types
import type { ProductFormProps } from "./types";
```

## Frontend Tailwind

### DO
- Utility classes only — no custom CSS per component
- `cn()` for conditional classes: `cn("base", condition && "conditional")`
- Mobile-first responsive: `sm:`, `md:`, `lg:`
- CSS variables for colors: `text-foreground`, `bg-background`
- Import `@jahonbozor/ui/globals.css` in `main.tsx`

### DON'T
- No inline `style` attributes
- No hardcoded colors — use semantic tokens
- No custom CSS files per component
- No `!important`

## Frontend Testing

### Stack
- `bun:test` — test runner
- `@testing-library/react` — component rendering
- `@testing-library/user-event` — user interactions
- `happy-dom` — DOM implementation

### Test Priority
1. **Must:** Zustand stores, permission hooks, auth flow, form validation
2. **Should:** Table components, API layer, route guards
3. **Nice:** Layout components, i18n switching

### Test Location

```
src/{layer}/__tests__/{name}.test.ts(x)

# Examples:
src/stores/__tests__/auth.store.test.ts
src/hooks/__tests__/use-permissions.test.ts
src/components/products/__tests__/product-form.test.tsx
```

### Store Test Pattern

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { useAuthStore } from "../auth.store";

describe("Auth Store", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null, user: null, permissions: [], isAuthenticated: false,
        });
    });

    test("should set auth data", () => {
        useAuthStore.getState().setAuth("token", mockUser, ["products:list"]);
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    test("should clear on logout", () => {
        useAuthStore.getState().setAuth("token", mockUser, []);
        useAuthStore.getState().clearAuth();
        expect(useAuthStore.getState().token).toBeNull();
    });
});
```

### DO
- Test behavior, not implementation
- AAA pattern (Arrange-Act-Assert)
- Reset store state in `beforeEach`
- Descriptive test names: `"should redirect when unauthenticated"`

### DON'T
- Don't test internal component state
- Don't test third-party libraries
- Don't leave `.only` in commits
- Don't mock what you don't own (prefer integration over unit for routes)
