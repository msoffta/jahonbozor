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
- [Linting & Formatting](#linting--formatting)
- [Versioning & Commits](#versioning--commits)

---

## Обязательно

- **Test First** — сначала пишем/обновляем тесты, затем код. При ревью модуля: сначала проверяем тесты
- **Verify After Every Action** — после каждого действия (создание/изменение файлов, миграции, генерация) запускать `bun run typecheck` и `bun run test`
- **Context7 MCP** — всегда использовать Context7 MCP для получения документации библиотек/API, генерации кода, шагов настройки и конфигурации, без необходимости явного запроса от пользователя
- **Unit тесты** — при создании/изменении модуля (service + index tests)
- **Обновлять RULES.md** — при изменении паттернов/конвенций
- **Обновлять CLAUDE.md** — при ключевых изменениях (модули, API, конфиги)

## Принципы

- **AHA (Avoid Hasty Abstractions) + Rule of Three** — дублирование допустимо до 2 раз. На третьем повторении — абстрагировать. Не создавать абстракции «на будущее», только когда паттерн повторился 3+ раза и стал очевидным

## Runtime

**Bun only** — не используем Node.js, npm, yarn, pnpm

```bash
bun install          # НЕ npm install
bun run dev          # НЕ node/npm run
bun run test         # Vitest across all workspaces
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
z.record(z.string(), z.any()) // Never use z.any()
    .nullable()
    .optional(); // Use .nullish() instead
```

### Zod 4 Specifics

```typescript
// ISO datetime validation (Zod 4)
z.iso.datetime();

// Union for Date fields (Date at runtime, string in JSON)
z.union([z.coerce.date(), z.iso.datetime()]);

// Unified error parameter (Zod 4 replaces message/invalid_type_error/required_error)
z.string().min(1, { error: "Обязательное поле" }); // NOT { message: "..." }
z.number({
    error: (issue) => (issue.input === undefined ? "Обязательное поле" : "Должно быть числом"),
});

// Human-readable error formatting
import { prettifyError } from "@jahonbozor/schemas";
prettifyError(zodError); // for logging
```

## Naming

| Pattern         | Example                                            |
| --------------- | -------------------------------------------------- |
| Service methods | `getAllProducts`, `createProduct`, `deleteProduct` |
| Route params    | `productIdParams`, `auditLogIdParams`              |
| Snapshots       | `createProductSnapshot(product)`                   |
| Context         | `AuditContext`, `staffId`, `requestId`             |

## File Structure

```
{domain}/
├── {domain}.index.ts     # Routes (Elysia instance)
└── {domain}.service.ts   # Business logic (abstract class)
```

## Service Pattern

```typescript
export abstract class DomainService {
    static async getAll(params, logger): Promise<ReturnSchema>;
    static async getById(id, logger): Promise<ReturnSchema>;
    static async create(data, context, logger): Promise<ReturnSchema>;
    static async update(id, data, context, logger): Promise<ReturnSchema>;
    static async delete(id, context, logger): Promise<ReturnSchema>;
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

| Level   | Use Case                  | Example                                            |
| ------- | ------------------------- | -------------------------------------------------- |
| `error` | System failures           | `logger.error("DB: Connection failed", { error })` |
| `warn`  | Auth failures, validation | `logger.warn("Auth: Invalid token", { userId })`   |
| `info`  | Business events           | `logger.info("Orders: Completed", { orderId })`    |
| `debug` | Dev details               | `logger.debug("Request", { body })`                |

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
const record = await prisma.model.create({ data }); // outside
await transaction.history.create({ data }); // inside
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

| Code | When                                     |
| ---- | ---------------------------------------- |
| 200  | Success (default)                        |
| 400  | Validation error, business logic failure |
| 401  | Unauthorized (no/invalid token)          |
| 403  | Forbidden (no permission)                |
| 404  | Resource not found                       |
| 500  | Internal server error                    |

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
where: {
    deletedAt: null;
}

// Include deleted
where: includeDeleted ? {} : { deletedAt: null };

// Restore
data: {
    deletedAt: null;
}
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
TelegramSessionStatus: ACTIVE | DISCONNECTED | BANNED
BroadcastStatus:       DRAFT | SCHEDULED | SENDING | PAUSED | COMPLETED | FAILED
BroadcastRecipientStatus: PENDING | SENT | FAILED
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
│   └── setup.ts           # Setup with Prisma mockDeep
├── vitest.config.ts        # Vitest configuration
└── src/api/{domain}/__tests__/
    ├── {domain}.service.test.ts
    └── {domain}.index.test.ts
```

### Mocking (Vitest)

```typescript
import { vi, describe, test, expect, beforeEach } from "vitest";

// vi.fn() — create mock functions
const mockFn = vi.fn((x: number) => x * 2);
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ id: 1 });
mockFn.mockRejectedValue(new Error("fail"));
expect(mockFn).toHaveBeenCalledWith(5);

// vi.spyOn() — spy on methods
const spy = vi.spyOn(service, "method").mockResolvedValue({});
expect(spy).toHaveBeenCalledTimes(1);

// vi.mock() — mock modules (hoisted automatically, order doesn't matter)
vi.mock("@backend/lib/prisma", () => ({ prisma: prismaMock }));
```

### Prisma Mock (test/setup.ts)

Type-safe mocks using `vitest-mock-extended`:

```typescript
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@backend/generated/prisma/client";

export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@backend/lib/prisma", () => ({ prisma: prismaMock }));

beforeEach(() => {
    mockReset(prismaMock);
});
```

### Type Guards for ReturnSchema

```typescript
import { expectSuccess, expectFailure } from "@backend/test/setup";

// Success — TS knows data exists
const success = expectSuccess(result);
expect(success.data).toEqual(expected);

// Failure — TS knows error exists
const failure = expectFailure(result);
expect(failure.error).toBe("Error");
```

### Service Test Pattern

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { prismaMock, createMockLogger, expectSuccess, expectFailure } from "@backend/test/setup";
import { Users } from "../users.service";

describe("Users.createUser", () => {
    const mockLogger = createMockLogger();

    test("should create user with valid data", async () => {
        // Arrange — TypeScript enforces all required fields
        const mockUser = { id: 1, fullname: "John", phone: "+998..." /* all fields */ };
        prismaMock.users.create.mockResolvedValue(mockUser);

        // Act
        const result = await Users.createUser({ fullname: "John" }, mockLogger);

        // Assert
        const success = expectSuccess(result);
        expect(success.data).toEqual(mockUser);
        expect(prismaMock.users.create).toHaveBeenCalled();
    });

    test("should handle database error", async () => {
        prismaMock.users.create.mockRejectedValue(new Error("DB error"));

        const result = await Users.createUser({ fullname: "John" }, mockLogger);

        const failure = expectFailure(result);
        expect(failure.error).toBeInstanceOf(Error);
    });
});
```

### Elysia Test Pattern

```typescript
import { describe, test, expect } from "vitest";
import { Elysia } from "elysia";
import { users } from "../users.index";

describe("Users API", () => {
    const app = new Elysia().use(users);

    test("GET /users", async () => {
        const response = await app.handle(new Request("http://localhost/users"));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
    });
});
```

### Test Modifiers

```typescript
test.skip("incomplete", () => {}); // Skip
test.todo("implement later"); // TODO
test.only("debug this", () => {}); // Only this

test("with timeout", () => {}, { timeout: 10000 }); // 10s timeout
test("retry", () => {}, { retry: 3 }); // Up to 3 retries
```

### Parametrized Tests

```typescript
test.each([
    [1, 2, 3],
    [0, 0, 0],
])("add(%i, %i) = %i", (a, b, expected) => {
    expect(a + b).toBe(expected);
});
```

### Test Naming

```typescript
// Хорошо
test("should return null when user not found", ...);
test("creates user with valid data", ...);

// Плохо
test("test1", ...);
test("works", ...);
```

### Commands

```bash
bun run test:backend                    # All tests
bun run test:backend -- --watch         # Watch mode
bun run test:backend -- --coverage      # With coverage
```

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

- Test behavior, not implementation
- Use AAA pattern (Arrange-Act-Assert)
- Group tests with `describe`
- Cover ALL edge cases — they catch real bugs
- Use `mockDeep` for type-safe Prisma mocks — no `as any`

### DON'T

- Don't rely on test execution order
- Don't leave `.only` in commits
- Don't test internal implementation details
- Don't use real external services
- Don't skip edge cases
- Don't use `as any` in mock return values — provide full objects

---

# Frontend

## Frontend File Naming

| Type        | Convention          | Example                            |
| ----------- | ------------------- | ---------------------------------- |
| Components  | `kebab-case.tsx`    | `product-form.tsx`                 |
| Stores      | `{domain}.store.ts` | `auth.store.ts`, `ui.store.ts`     |
| API files   | `{domain}.api.ts`   | `products.api.ts`                  |
| Route files | TanStack convention | `$productId.tsx`, `_dashboard.tsx` |
| Tests       | `{name}.test.ts(x)` | `product-form.test.tsx`            |
| i18n        | `{namespace}.json`  | `products.json`, `common.json`     |
| Hooks       | `use-{name}.ts`     | `use-permissions.ts`               |

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
import { persist } from "zustand/middleware"; // only when needed

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    permissions: [],
    isAuthenticated: false,
    setAuth: (token, user, permissions) => set({ token, user, permissions, isAuthenticated: true }),
    clearAuth: () => set({ token: null, user: null, permissions: [], isAuthenticated: false }),
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
t("title"); // "Mahsulotlar"
t("common:save"); // Cross-namespace access
```

### Language Switch

```typescript
const locale = useUIStore((state) => state.locale);
useEffect(() => {
    i18n.changeLanguage(locale);
}, [locale]);
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

## Frontend Animation

Все фронтенд-приложения должны быть **интерактивными и приятными** в использовании.

### Обязательно

- **`PageTransition`** — обёртка контента каждой страницы (fade-in + slide-up)
- **`whileTap`** — на всех кнопках и интерактивных элементах (scale: 0.9-0.95)
- **`AnimatePresence`** — для conditional renders (errors, toasts, modals)
- **`AnimatedList`** — для списков с stagger-эффектом
- **Cursor types** — `pointer` на кликабельных, `text` на инпутах, `not-allowed` на disabled (глобально через `globals.css`)

### Spring Configs

| Name     | Config                        | Use                         |
| -------- | ----------------------------- | --------------------------- |
| Snappy   | `stiffness: 400, damping: 17` | whileTap, press feedback    |
| Smooth   | `stiffness: 300, damping: 25` | Page transitions, entrance  |
| Balanced | `stiffness: 400, damping: 30` | Layout animations, nav pill |

### Импорт

```typescript
import {
    motion,
    AnimatePresence,
    LayoutGroup,
    PageTransition,
    AnimatedList,
    AnimatedListItem,
    FadeIn,
} from "@jahonbozor/ui";
```

> Подробнее: [docs/frontend.md](frontend.md#animation-motion)

## Frontend Testing

### Stack

- **Vitest** — test runner (with `vi.mock()` auto-hoisting)
- `@testing-library/react` — component rendering
- `@testing-library/user-event` — user interactions
- `happy-dom` — DOM implementation (via `vitest.config.ts`)

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
import { describe, test, expect, beforeEach } from "vitest";
import { useAuthStore } from "../auth.store";

describe("Auth Store", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
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

### Mocking (vi.mock — hoisted automatically)

```typescript
import { vi } from "vitest";
import { Header } from "../header";

// vi.mock is hoisted above imports — order doesn't matter
vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
```

### Store Reset Pattern

```typescript
beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, permissions: [], isAuthenticated: false });
});
```

### Query Priority

`getByRole` > `getByLabelText` > `getByText` > `getByDisplayValue` > `container.querySelector`

### DO

- Test behavior, not implementation
- AAA pattern (Arrange-Act-Assert)
- Reset store state in `beforeEach`
- Descriptive test names: `"should redirect when unauthenticated"`
- Use `vi.mock()` for module mocking
- Prefer semantic queries (`getByRole`, `getByText`)
- Use `waitFor()` for async assertions

### DON'T

- Don't test internal component state
- Don't test third-party libraries
- Don't leave `.only` in commits
- Don't mock Zustand's `create` — test the real store
- Don't use `container.querySelector` when a semantic query is available
- Don't mock what you don't own (prefer integration over unit for routes)

> Full guide: [docs/frontend-testing.md](frontend-testing.md)

## Linting & Formatting

### Tooling

| Tool             | Purpose                            | Config                                 |
| ---------------- | ---------------------------------- | -------------------------------------- |
| ESLint 10        | Code quality, bugs, best practices | `eslint.config.js` (root, flat config) |
| Prettier         | Code formatting                    | `.prettierrc.json` (root)              |
| simple-git-hooks | Pre-commit hook                    | `package.json` → `simple-git-hooks`    |
| lint-staged      | Run lint/format on staged files    | `package.json` → `lint-staged`         |

### Commands

```bash
bun run lint               # ESLint check all workspaces
bun run lint:fix           # ESLint auto-fix
bun run format             # Prettier format all files
bun run format:check       # Check formatting (CI)
```

### ESLint Config Structure

Единый `eslint.config.js` в корне монорепо. Структура:

1. **Global ignores** — `dist/`, `node_modules/`, `coverage/`, `*.gen.ts`, `src/generated/`
2. **Base (all `*.{ts,tsx}`)** — recommended + type-checked + stylistic + import sorting
3. **React (frontend + ui)** — React hooks, refresh, react-x, react-dom
4. **Backend + Bot** — Node/Bun globals
5. **Pure packages** — Node globals
6. **Startup files** — `no-console: off` для entry points
7. **Config files** — разрешён `export default`
8. **Test files** — ослаблены strict правила
9. **eslint-config-prettier** — последний, отключает formatting-правила

### Key Rules

| Rule                                         | Level  | Notes                                                        |
| -------------------------------------------- | ------ | ------------------------------------------------------------ |
| `simple-import-sort/imports`                 | error  | react → 3rd-party → @jahonbozor → aliases → relative → types |
| `simple-import-sort/exports`                 | error  | Sorted exports                                               |
| `@typescript-eslint/no-explicit-any`         | warn\* | Upgrade to error после cleanup                               |
| `@typescript-eslint/consistent-type-imports` | error  | `import type` для type-only                                  |
| `@typescript-eslint/no-unused-vars`          | error  | `_prefix` ignored                                            |
| `no-console`                                 | warn\* | Upgrade to error после cleanup                               |
| `@typescript-eslint/no-floating-promises`    | error  | Must handle promises                                         |
| `no-restricted-syntax` (default export)      | warn\* | Named exports preferred                                      |
| `@typescript-eslint/no-misused-promises`     | error  | `checksVoidReturn.attributes: false`                         |

> \* Правила с `warn` будут повышены до `error` после исправления существующих нарушений.

### Import Order (enforced by ESLint)

```typescript
// 1. Side effects
import "./styles.css";

// 2. Node/Bun builtins
import { resolve } from "node:path";

// 3. React
import { useState } from "react";

// 4. Third-party
import { useQuery } from "@tanstack/react-query";

// 5. @jahonbozor workspace packages
import { Button } from "@jahonbozor/ui";

// 6. Workspace aliases (@backend/, @bot/, @/)
import { api } from "@/lib/api-client";

// 7. Relative imports
import { helper } from "./utils";

// 8. Type imports
import type { Props } from "./types";
```

### Prettier Config

- Double quotes, semicolons, trailing commas
- 4-space indent (2-space for JSON/YAML/Prisma)
- 100 char print width
- `prettier-plugin-tailwindcss` — auto-sorts Tailwind classes

### Pre-commit Hook

Автоматически запускается при `git commit`:

- `*.{ts,tsx}` → `eslint --fix` + `prettier --write`
- `*.{json,md,yml,yaml,css,prisma}` → `prettier --write`

### CI Integration

В `lint-typecheck` job CI pipeline добавлены шаги:

- `bun run lint` (с `continue-on-error: true` до cleanup)
- `bun run format:check` (с `continue-on-error: true` до cleanup)

### Overrides & Exceptions

- **Test files** (`__tests__/`, `*.test.*`, `test/`) — `any`, `non-null-assertion`, `unsafe-*` разрешены
- **Entry files** (`apps/*/src/index.ts`) — `console.*` разрешён
- **Config files** (`vite.config.ts`, `vitest.config.ts`) — `export default` разрешён
- **Eslint disable** — использовать точечно с комментарием причины:
    ```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BigInt serialization hack
    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };
    ```

## Versioning & Commits

### Conventional Commits (enforced)

Формат коммит-сообщений — [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`, `build`, `revert`

**Scopes:** `backend`, `bot`, `admin`, `user`, `ui`, `schemas`, `logger`, `utils`, `ci`, `deps`

**Примеры:**

```
feat(backend): add product search endpoint
fix(ui): correct DataTable cell alignment on resize
chore(deps): update Prisma to v7.4
ci: add release workflow for changesets
```

> Scope опционален (warning, не error), но рекомендуется.

### Commands

```bash
bun run commit             # Интерактивный промпт (commitizen)
bun run changeset          # Создать changeset файл
bun run version-packages   # Bump версий + CHANGELOG (только CI)
```

### Changesets

- **Когда создавать:** PR с user-facing или developer-facing изменениями
- **Когда НЕ нужен:** CI-only, docs-only, test-only изменения
- **Стратегия:** Fixed versioning — все workspace получают одинаковую версию
- **Flow:** `bun run changeset` → выбрать пакеты → тип bump → описание → файл в `.changeset/`

### Git Hooks

| Hook         | Tool        | Command                                              |
| ------------ | ----------- | ---------------------------------------------------- |
| `pre-commit` | lint-staged | `eslint --fix` + `prettier --write` на staged файлах |
| `commit-msg` | commitlint  | Валидация формата conventional commits               |

### Release Flow

1. PR с кодом + `.changeset/*.md` файлом → merge в `main`
2. `release.yml` создаёт/обновляет "Version Packages" PR (bump `package.json` + `CHANGELOG.md`)
3. Merge "Version Packages" PR → `ci-cd.yml` → build Docker images с semver тегами → deploy
