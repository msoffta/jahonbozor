# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

All commands run from the **root directory** and use the root `.env` file.

```bash
# Install dependencies
bun install

# Database
bun run db:up              # Start PostgreSQL via Docker
bun run db:down            # Stop PostgreSQL

# Development
bun run dev                # Run backend (alias for dev:backend)
bun run dev:backend        # Run backend with watch mode on port 3000
bun run dev:frontend       # Run frontend (when available)

# Prisma
bun run prisma:generate    # Generate Prisma client
bun run prisma:seed        # Seed the database
bun run prisma:migrate     # Create and apply migrations
bun run prisma:studio      # Open Prisma Studio GUI
```

## Architecture

### Monorepo Structure
Bun workspaces with two directories:
- `apps/*` - Applications (backend, frontend)
- `packages/*` - Shared libraries (logger, schemas, utils, ui)

### Backend (apps/backend)
Elysia framework with TypeScript running on Bun.

**API Route Organization:**
- `src/api/public/` - Unauthenticated endpoints (auth, etc.)
- `src/api/private/` - Protected endpoints requiring JWT authentication
- `src/lib/middleware.ts` - Auth macro with JWT verification
- `src/lib/prisma.ts` - Prisma client with PostgreSQL adapter

**Key Plugins:** cors, jwt, bearer, openapi, static, sentry

### Route Prefix Convention

Routes use hierarchical prefixes — each level adds its segment:

```typescript
// src/index.ts — base prefix /api
app.use(publicRoutes.prefix("/api"))
   .use(privateRoutes.prefix("/api"))

// api/public/index.ts — access level prefix /public
export const publicRoutes = new Elysia({ prefix: "/public" })
    .use(auth)
    .use(publicProducts)
    .use(publicOrders);

// api/public/auth/auth.index.ts — domain prefix /auth
const auth = new Elysia({ prefix: "/auth" })
    .post("/login", ...)  // → /api/public/auth/login
    .post("/refresh", ...) // → /api/public/auth/refresh
```

**Resulting paths:**
- Public: `/api/public/{domain}/{endpoint}`
- Private: `/api/private/{domain}/{endpoint}`

### Domain File Naming

Each domain folder contains:
- `{domain}.index.ts` — Route definitions with Elysia instance
- `{domain}.service.ts` — Business logic and database queries

```
src/api/
├── public/
│   ├── index.ts              # Aggregates all public routes
│   ├── auth/
│   │   ├── auth.index.ts     # prefix: "/auth"
│   │   └── auth.service.ts
│   ├── products/
│   │   ├── products.index.ts # prefix: "/products"
│   │   └── products.service.ts
│   └── orders/
│       ├── orders.index.ts   # prefix: "/orders"
│       └── orders.service.ts
└── private/
    ├── index.ts              # Aggregates all private routes
    ├── users/
    │   ├── users.index.ts    # prefix: "/users"
    │   └── users.service.ts
    └── ...
```

### API Response Pattern

**All endpoint handlers must return `Promise<ReturnSchema>`:**

```typescript
import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";

.post("/endpoint", async ({ set }): Promise<ReturnSchema> => {
    try {
        // Success: return data wrapped in success object
        return { success: true, data: { user, token } };
    } catch (error) {
        logger.error("Module: Error description", { error });
        return { success: false, error };
    }
}, { body: Schema })
```

**Error responses with HTTP status codes:**
```typescript
set.status = 401;
return { success: false, error: "Unauthorized" };
```

### Shared Packages

**@jahonbozor/schemas** - Zod validation schemas
- `src/base.model.ts` - BaseModel (id, createdAt, updatedAt), ReturnSchema
- `src/auth/auth.model.ts` - Token discriminated union for Staff/User types

**@jahonbozor/logger** - Winston logger factory
- `createLogger(serviceName)` - Returns configured logger (colored dev, JSON prod)

## Logging Guidelines

### Log Levels (use appropriately)
```typescript
import { createLogger } from "@jahonbozor/logger";
const logger = createLogger("ServiceName");

// error - System failures, unrecoverable errors, exceptions
logger.error("Database connection failed", error);
logger.error("Users: Error in createUser", { userId, error });

// warn - Recoverable issues, auth failures, validation errors
logger.warn("Users: Invalid Telegram hash", { telegramId: body.id });
logger.warn("Auth: Staff not found", { username });

// info - Important business events, successful operations
logger.info("User created successfully", { userId });
logger.info("Order completed", { orderId, total });

// debug - Development details, request/response data
logger.debug("Request payload", { body });
logger.debug("Query result", { count: users.length });
```

### Logging Conventions
- Prefix with service/module name: `"Users: Error message"`, `"Auth: Warning"`
- Always include relevant context as metadata: `{ userId, orderId, telegramId }`
- Log errors with the error object for stack traces
- Use `info` for successful operations, `warn` for handled failures

### Database
PostgreSQL via Docker Compose with Prisma ORM.
- Prisma schema: `apps/backend/prisma/schema.prisma`
- Generated client: `apps/backend/src/generated/prisma`
- Timezone: Asia/Tashkent

## TypeScript Guidelines

### Strict Typing is Critical
- **Never use `string` where a specific literal union exists** — use the defined type
- **Permissions must be `Permission[]`**, not `string[]` — enables autocomplete and compile-time validation
- **Zod enums should preserve literal types** — use `as [T, ...T[]]` tuple for `z.enum()`
- **Avoid `any`** — use `unknown` or specific types

```typescript
// BAD - loses type information
const permissions: string[] = ["users:create"];
z.enum(values as [string, ...string[]]);

// GOOD - strict typing
const permissions: Permission[] = [Permission.USERS_CREATE];
z.enum(ALL_PERMISSIONS); // where ALL_PERMISSIONS is [Permission, ...Permission[]]
```

### Zod Schemas
- Export both schema and inferred type: `export type X = z.infer<typeof X>`
- Use `.extend()` for inheritance, `.pick()` / `.omit()` for partial schemas
- Validate at boundaries (API input), trust internal code
- **Use `.nullable()` for optional fields** — corresponds to Prisma `String?`
- **Use `.nullish()` instead of `.nullable().optional()`** — cleaner syntax for fields that can be null or undefined
- Extract reusable schemas (e.g., `telegramIdSchema`) to avoid duplication
- **DTO schemas derive from Model** — use `Model.omit({ id, createdAt, updatedAt })` instead of duplicating fields

### Naming Conventions
- **No abbreviations in variable names** — use full, descriptive names
- **Never use single letters** like `t`, `x`, `e` (except `i` in simple loops)
- **Be explicit** — `tokenRecord` not `t`, `staffData` not `s`, `error` not `e`

```typescript
// BAD - unclear abbreviations
const t = await prisma.refreshToken.findUnique(...);
if (t && !t.revoked) { ... }
users.map(u => u.id);

// GOOD - descriptive names
const tokenRecord = await prisma.refreshToken.findUnique(...);
if (tokenRecord && !tokenRecord.revoked) { ... }
users.map(user => user.id);
```

### Comments
- **Comment "why", not "what"** — code explains what, comments explain why
- **Don't comment obvious code** — self-documenting code doesn't need comments
- **No comment pollution** — don't add comments to every line

**Where comments ARE needed:**
- Non-obvious business logic
- Workarounds and hacks (with TODO if temporary)
- Complex regex or algorithms
- Security-related decisions

**Where comments are NOT needed:**
- Every line of code
- Obvious operations (`// increment counter`)
- Closing braces (`// end if`)

```typescript
// BAD - states the obvious
const userId = user.id; // get user id
if (tokenRecord.revoked) { // check if revoked
    return null;
}

// GOOD - explains business decision
// Token rotation: revoke old token to prevent replay attacks
await Auth.revokeRefreshToken(refreshTokenValue);

// Telegram hash validation uses HMAC-SHA256 as per official docs
const secretKey = crypto.createHash("sha256").update(botToken).digest();
```

## Environment Variables
Copy `.env.example` to `.env` in the **root directory** and configure:
- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` - PostgreSQL credentials (for Docker Compose)
- `DATABASE_URL` - PostgreSQL connection string (for the application)
- `JWT_SECRET` - Secret for authentication tokens
- `TELEGRAM_BOT_TOKEN` - For Telegram auth hash validation
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Controls logger format (`development` | `production`)
- `LOG_LEVEL` - Winston log level (`error` | `warn` | `info` | `debug`)
