# Backend Conventions

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Backend Organization
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

## Domain File Pattern
Each domain folder contains:
- `{domain}.index.ts` — Route definitions (Elysia instance)
- `{domain}.service.ts` — Business logic and database queries

## Route Prefix Convention
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

All endpoints return typed `Promise<ReturnSchema<T>>` with pre-composed aliases per module:

```typescript
// packages/schemas/src/common/base.model.ts
export type ReturnSchema<T = unknown> = { success: true; data: T } | { success: false; error: unknown };

// Each module's dto.ts defines concrete aliases:
export type PublicProductsListResponse = ReturnSchema<{ count: number; products: PublicProductItem[] }>;
export type AdminOrderDetailResponse = ReturnSchema<AdminOrderItem>;

// Route handler usage:
import type { PublicProductsListResponse } from "@jahonbozor/schemas/src/products";

.get("/", async ({ query, logger }): Promise<PublicProductsListResponse> => {
    try {
        return { success: true, data: { count, products } };
    } catch (error) {
        logger.error("Products: List error", { error });
        return { success: false, error };
    }
}, { query: ProductsPagination })

// Service return types:
static async listProducts(params): Promise<PublicProductsListResponse>

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
import { auditInTransaction, audit } from "@backend/lib/audit";

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

### From Prisma (`@backend/generated/prisma/enums`)
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

## Environment Variables

Single `.env` file in **monorepo root** — all apps load from there via `bun --env-file` (backend) and Vite `envDir` (frontends).

Copy `.env.example` → `.env` in root directory:
- `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` — Docker Compose credentials
- `DATABASE_URL` — PostgreSQL connection string (Prisma)
- `JWT_SECRET` — Authentication token secret
- `TELEGRAM_BOT_TOKEN` — Telegram auth validation
- `SENTRY_DSN` — Sentry error tracking (optional)
- `VITE_TELEGRAM_BOT_USERNAME` — Telegram bot username for login widget (frontend)

> **Важно:** всегда запускайте команды через корневой `package.json` (`bun run dev`, `bun test`, `bun run prisma:migrate` и т.д.) — они автоматически передают `--env-file .env` в бэкенд. При запуске напрямую из `apps/backend/` скрипты также настроены на `--env-file ../../.env`.

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
