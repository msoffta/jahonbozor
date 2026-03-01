# Frontend Documentation

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Frontend Architecture

### Admin App Structure (`apps/frontend/admin/src/`)
```
src/
├── main.tsx                          # App entry with providers
├── routeTree.gen.ts                  # Auto-generated (TanStack Router)
├── routes/
│   ├── __root.tsx                    # Root layout: QueryClientProvider, i18n
│   ├── _auth.tsx                     # Unauthenticated layout (centered card)
│   ├── _auth/
│   │   └── login.tsx                 # /login
│   ├── _dashboard.tsx                # Authenticated layout (sidebar + header)
│   └── _dashboard/
│       ├── index.tsx                 # / (dashboard home)
│       ├── products/
│       │   ├── index.tsx             # /products (list + table)
│       │   ├── new.tsx               # /products/new (create form)
│       │   └── $productId.tsx        # /products/$productId (edit/view)
│       ├── categories/
│       │   ├── index.tsx             # /categories (list + tree)
│       │   ├── new.tsx               # /categories/new
│       │   └── $categoryId.tsx       # /categories/$categoryId
│       ├── orders/
│       │   ├── index.tsx             # /orders (list)
│       │   ├── new.tsx               # /orders/new
│       │   └── $orderId.tsx          # /orders/$orderId
│       ├── staff/
│       │   ├── index.tsx             # /staff (list)
│       │   ├── new.tsx               # /staff/new
│       │   ├── $staffId.tsx          # /staff/$staffId
│       │   └── roles/
│       │       ├── index.tsx         # /staff/roles (list)
│       │       ├── new.tsx           # /staff/roles/new
│       │       └── $roleId.tsx       # /staff/roles/$roleId
│       ├── users/
│       │   ├── index.tsx             # /users (list)
│       │   └── $userId.tsx           # /users/$userId
│       └── audit-logs/
│           ├── index.tsx             # /audit-logs (list + filters)
│           └── $logId.tsx            # /audit-logs/$logId
├── api/
│   ├── client.ts                     # Fetch wrapper with auth headers + token refresh
│   ├── auth.api.ts                   # login, refresh, logout, me
│   ├── products.api.ts               # TanStack Query options + mutations
│   ├── categories.api.ts
│   ├── orders.api.ts
│   ├── staff.api.ts
│   ├── users.api.ts
│   └── audit-logs.api.ts
├── stores/
│   ├── auth.store.ts                 # token, user, permissions, isAuthenticated
│   └── ui.store.ts                   # sidebar, locale
├── hooks/
│   ├── use-auth.ts                   # Login/logout/refresh orchestration
│   └── use-permissions.ts            # Permission check hooks
├── components/
│   ├── layouts/
│   │   ├── dashboard-layout.tsx      # Sidebar + header + Outlet
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── {domain}/                     # Domain-specific components
│       ├── {domain}-form.tsx         # Create/edit form
│       ├── {domain}-table.tsx        # TanStack Table
│       └── {domain}-columns.tsx      # Column definitions
├── i18n/
│   ├── config.ts                     # i18next initialization
│   ├── uz/                           # Uzbek translations
│   │   ├── common.json
│   │   ├── products.json
│   │   └── ...per domain
│   └── ru/                           # Russian translations
│       ├── common.json
│       ├── products.json
│       └── ...per domain
└── lib/
    └── utils.ts                      # cn() utility (re-exported from packages/ui)
```

### User App Structure (`apps/frontend/user/src/`)
```
src/
├── main.tsx
├── routeTree.gen.ts
├── routes/
│   ├── __root.tsx
│   ├── _public.tsx                   # Public layout (navbar + footer)
│   ├── _public/
│   │   ├── index.tsx                 # / (home / featured products)
│   │   ├── catalog/
│   │   │   ├── index.tsx             # /catalog
│   │   │   └── $categoryId.tsx       # /catalog/$categoryId
│   │   └── product/
│   │       └── $productId.tsx        # /product/$productId
│   ├── _user.tsx                     # Authenticated user layout
│   └── _user/
│       ├── cart.tsx                   # /cart
│       ├── orders/
│       │   ├── index.tsx             # /orders
│       │   └── $orderId.tsx          # /orders/$orderId
│       └── profile.tsx               # /profile
├── api/                              # Same pattern as admin
├── stores/
│   ├── auth.store.ts
│   ├── cart.store.ts                 # Shopping cart (persisted to localStorage)
│   └── ui.store.ts
├── hooks/
├── components/
│   ├── layouts/
│   │   ├── public-layout.tsx
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── catalog/
│   │   ├── product-card.tsx
│   │   ├── product-grid.tsx
│   │   └── category-nav.tsx
│   └── cart/
│       ├── cart-item.tsx
│       └── cart-summary.tsx
├── i18n/                             # Same structure as admin
└── lib/
    └── utils.ts
```

### Domain File Pattern (Frontend)
Each domain in `components/` contains:
- `{domain}-form.tsx` — Create/edit form (TanStack Form + Zod)
- `{domain}-table.tsx` — Data table (TanStack Table)
- `{domain}-columns.tsx` — Column definitions for table

Each domain in `api/` contains:
- `{domain}.api.ts` — Query key factory + `queryOptions` + `useMutation` hooks

## Frontend Tech Stack

| Library | Purpose | Version |
|---------|---------|---------|
| React | UI framework | 19.2 |
| Vite | Build tool | 7.3 |
| SWC | Transpiler (via @vitejs/plugin-react-swc) | - |
| TanStack Router | File-based routing with type safety | v1 |
| TanStack Query | Server state management | v5 |
| TanStack Table | Data tables | v8 |
| TanStack Virtual | Virtual scrolling | v3 |
| Zustand | Client state management | v5 |
| Tailwind CSS | Utility-first CSS | v4 |
| shadcn/ui | Headless UI components (via @jahonbozor/ui) | - |
| TanStack Form | Form management with Zod validation | v1 |
| react-i18next | Internationalization (uz/ru) | - |
| lucide-react | Icons | - |
| Motion | Animations (via @jahonbozor/ui) | v12 |
| Elysia Eden | Type-safe API client (treaty) | v1 |
| vite-tsconfig-paths | Path alias resolution from tsconfig | - |

## Frontend Routing

### Layout Routes (TanStack Router)

Underscore-prefixed files are **layout routes** — they wrap child routes without creating a URL segment.

```
_auth.tsx          → Unauthenticated layout (centered card, no sidebar)
_auth/login.tsx    → /login

_dashboard.tsx     → Authenticated layout (sidebar + header)
_dashboard/
  index.tsx        → /
  products/
    index.tsx      → /products
    new.tsx        → /products/new
    $productId.tsx → /products/$productId
```

### Protected Route Pattern

The `_dashboard` layout route acts as auth guard via `beforeLoad`:

```typescript
// routes/_dashboard.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth.store";

export const Route = createFileRoute("/_dashboard")({
    beforeLoad: async () => {
        const { token } = useAuthStore.getState();
        if (!token) {
            throw redirect({ to: "/login" });
        }
    },
    component: DashboardLayout,
});
```

### Permission-Based Route Guard

Individual routes can check specific permissions:

```typescript
// routes/_dashboard/staff/index.tsx
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

### Route Data Loading

Use `loader` with TanStack Query for data prefetching:

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

### Router Context

Root route provides shared context to all child routes:

```typescript
// routes/__root.tsx
interface RouterContext {
    queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
});

// main.tsx
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,    // 5 minutes
            retry: 1,
        },
    },
});

const router = createRouter({
    routeTree,
    context: { queryClient },
});
```

## Frontend State Management

### Zustand: Client State Only

Zustand stores hold **client-only** state. Server data lives in TanStack Query.

**Auth Store:**
```typescript
// stores/auth.store.ts
import { create } from "zustand";
import type { Permission } from "@jahonbozor/schemas";

interface AuthState {
    token: string | null;
    user: TokenStaff | null;       // or TokenUser for user app
    permissions: Permission[];
    isAuthenticated: boolean;

    setAuth: (token: string, user: TokenStaff, permissions: Permission[]) => void;
    clearAuth: () => void;
}

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

**UI Store (persisted):**
```typescript
// stores/ui.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
    sidebarOpen: boolean;
    locale: "uz" | "ru";
    toggleSidebar: () => void;
    setLocale: (locale: "uz" | "ru") => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            locale: "uz",
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            setLocale: (locale) => set({ locale }),
        }),
        { name: "ui-store" },
    ),
);
```

**Cart Store (user app only, persisted):**
```typescript
// stores/cart.store.ts — uses persist middleware
interface CartItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
}
```

### TanStack Query: Server State

**Query Key Factory** (one per domain):
```typescript
// api/products.api.ts
export const productKeys = {
    all: ["products"] as const,
    lists: () => [...productKeys.all, "list"] as const,
    list: (params: ProductsPagination) => [...productKeys.lists(), params] as const,
    details: () => [...productKeys.all, "detail"] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
    history: (id: number) => [...productKeys.all, "history", id] as const,
};
```

**Query Options:**
```typescript
export const productsListOptions = (params: ProductsPagination) =>
    queryOptions({
        queryKey: productKeys.list(params),
        queryFn: () => apiClient.get("/api/private/products", { params }),
    });
```

**Mutations with Cache Invalidation:**
```typescript
export function useCreateProduct() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateProductBody) =>
            apiClient.post("/api/private/products", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.lists() });
        },
    });
}
```

### State Management Rules
- **Zustand** = client state (auth, UI preferences, cart)
- **TanStack Query** = server state (products, orders, categories, etc.)
- **Never** store server data in Zustand
- **Never** duplicate TanStack Query cache in Zustand
- Use `persist` middleware only for UI preferences and cart

## Frontend API Layer

### Elysia Eden (Treaty)

Type-safe API client using Elysia Eden treaty. Backend exports `App` type:

```typescript
// apps/backend/src/index.ts
export type App = typeof app;

// apps/frontend/*/src/lib/api-client.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@jahonbozor/backend";
import { useAuthStore } from "@/stores/auth.store";

export const api = treaty<App>(window.location.origin, {
    headers() {
        const { token } = useAuthStore.getState();
        if (token) {
            return { Authorization: `Bearer ${token}` };
        }
    },
    onResponse(response) {
        if (response.status === 401) {
            tryRefreshToken();
        }
    },
    fetch: { credentials: "include" },
});

// Usage — fully typed, autocomplete for paths and params:
const { data } = await api.api.public.products.get({ query: { page: 1 } });
const { data } = await api.api.private.products.post({ name: "Product" });
const { data } = await api.api.private.products({ id: 1 }).get();
```

### Vite Proxy

Development proxy to avoid CORS:

```typescript
// vite.config.ts
export default defineConfig({
    server: {
        port: 5173,  // admin: 5173, user: 5174
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
            },
        },
    },
});
```

### API File Pattern

Each domain has one API file with query keys, query options, and mutation hooks:

```typescript
// api/{domain}.api.ts
export const domainKeys = { ... };                    // Query key factory
export const domainListOptions = (params) => ...;     // queryOptions
export const domainDetailOptions = (id) => ...;       // queryOptions
export function useCreateDomain() { ... }             // useMutation
export function useUpdateDomain(id) { ... }           // useMutation
export function useDeleteDomain() { ... }             // useMutation
```

### Eden Treaty Type Inference Gotchas

Eden Treaty properly infers scalar fields but **loses element types for nested arrays** (e.g. `items: OrderItemResponse[]` becomes `items: any[]`). Fix with explicit queryFn return type annotations:

```typescript
import type { UserOrderItem } from "@jahonbozor/schemas/src/orders";

// BAD — items will be any[]
queryFn: async () => {
    const { data, error } = await api.api.public.orders.get({ query });
    if (error) throw error;
    return data.data;
}

// GOOD — explicit return type preserves nested array types
queryFn: async (): Promise<{ count: number; orders: UserOrderItem[] }> => {
    const { data, error } = await api.api.public.orders.get({ query });
    if (error) throw error;
    return data.data;
}
```

> This is NOT an `as` cast — the return type annotation is type-safe. If the actual data doesn't match, TS will error.

### Date Fields in Components

Schema interfaces define `createdAt`/`updatedAt` as `Date`, but JSON serialization delivers strings at runtime. Component props that receive these values should use `Date | string`:

```typescript
interface OrderCardProps {
    createdAt: Date | string;  // Date in TS types, string at JSON runtime
}

function formatDate(dateStr: Date | string): string {
    return new Date(dateStr).toLocaleDateString("ru-RU", { ... });
}
```

## Frontend Forms

### TanStack Form + Zod

Forms use TanStack Form with Zod validation, reusing schemas from `@jahonbozor/schemas`:

```typescript
// components/products/product-form.tsx
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { CreateProductBody } from "@jahonbozor/schemas/src/products";
import type { CreateProductBody as CreateProductBodyType } from "@jahonbozor/schemas/src/products";

interface ProductFormProps {
    defaultValues?: Partial<CreateProductBodyType>;
    onSubmit: (data: CreateProductBodyType) => void;
    isLoading?: boolean;
}

export function ProductForm({ defaultValues, onSubmit, isLoading }: ProductFormProps) {
    const { t } = useTranslation("products");
    const form = useForm({
        defaultValues: {
            name: "",
            price: 0,
            costprice: 0,
            categoryId: 0,
            remaining: 0,
            ...defaultValues,
        },
        onSubmit: async ({ value }) => onSubmit(value),
        validatorAdapter: zodValidator(),
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="space-y-4"
        >
            <form.Field
                name="name"
                validators={{ onChange: CreateProductBody.shape.name }}
                children={(field) => (
                    <div>
                        <label>{t("name")}</label>
                        <Input
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                                {field.state.meta.errors[0]}
                            </p>
                        )}
                    </div>
                )}
            />
            {/* More fields... */}
            <Button type="submit" disabled={isLoading}>
                {isLoading ? t("common:saving") : t("common:save")}
            </Button>
        </form>
    );
}
```

### Form Component Contract

Every form component follows this interface:
- `defaultValues` — optional, for edit mode
- `onSubmit` — callback with validated data
- `isLoading` — disables submit button during mutation
- Uses `zodValidator()` adapter with schemas from `@jahonbozor/schemas`
- Per-field validation via `validators.onChange` with Zod shape
- All labels use `useTranslation()` for i18n

## Frontend i18n

### Setup (react-i18next)

```typescript
// i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
    resources: {
        uz: { common: uzCommon, products: uzProducts, ... },
        ru: { common: ruCommon, products: ruProducts, ... },
    },
    lng: savedLocale,          // from localStorage via Zustand
    fallbackLng: "uz",
    defaultNS: "common",
    interpolation: { escapeValue: false },
});
```

### Translation File Structure

Per-namespace JSON files for each language:

```
i18n/
├── uz/
│   ├── common.json       # save, cancel, delete, edit, search, loading, etc.
│   ├── auth.json         # login, username, password, etc.
│   ├── products.json     # product-specific labels
│   ├── categories.json
│   ├── orders.json
│   ├── staff.json
│   └── audit-logs.json
└── ru/
    ├── common.json
    ├── auth.json
    └── ...same structure
```

### Usage
```typescript
import { useTranslation } from "react-i18next";

function ProductsListPage() {
    const { t } = useTranslation("products");
    return <h1>{t("title")}</h1>;  // "Mahsulotlar" or "Продукты"
}

// Cross-namespace
const { t } = useTranslation("products");
t("common:save")  // Access common namespace
```

### Language Switch Sync

Language changes in Zustand UI store sync with i18next:

```typescript
const locale = useUIStore((state) => state.locale);
useEffect(() => {
    i18n.changeLanguage(locale);
}, [locale]);
```

### Languages
- **uz** — Uzbek (default / fallback)
- **ru** — Russian

## Shared UI Package

### Location: `packages/ui/`

```
packages/ui/
├── package.json                      # name: "@jahonbozor/ui"
├── tailwind.config.ts                # Base Tailwind config with CSS variables
├── globals.css                       # shadcn/ui CSS variables + Tailwind directives
├── src/
│   ├── index.ts                      # Re-exports all components
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── select.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── form.tsx              # TanStack Form helpers
│   │   └── shared/                   # Higher-level reusable components
│   │       ├── data-table.tsx        # Generic TanStack Table wrapper
│   │       ├── confirm-dialog.tsx    # "Are you sure?" dialog
│   │       ├── loading-spinner.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       └── language-switch.tsx   # uz/ru toggle
│   └── lib/
│       └── utils.ts                  # cn() = clsx + twMerge
```

### Usage from Apps

```typescript
import { Button, Input, Dialog } from "@jahonbozor/ui";
import { DataTable, ConfirmDialog } from "@jahonbozor/ui";
import { cn } from "@jahonbozor/ui";
```

### Dependencies

```json
// packages/ui/package.json
{
    "name": "@jahonbozor/ui",
    "dependencies": {
        "class-variance-authority": "...",
        "clsx": "...",
        "tailwind-merge": "...",
        "lucide-react": "...",
        "motion": "...",
        "@radix-ui/react-*": "..."
    },
    "peerDependencies": {
        "react": "^19",
        "react-dom": "^19"
    }
}
```

### Tailwind Configuration

Both frontend apps import the shared Tailwind config and globals.css from `@jahonbozor/ui`:

```typescript
// apps/frontend/admin/src/main.tsx
import "@jahonbozor/ui/globals.css";
```

Theming uses CSS variables defined in `globals.css` (light/dark mode support via shadcn/ui convention).

## Frontend Auth Flow

### 1. Login Sequence (Admin)

1. User navigates to `/login` (the `_auth` layout)
2. Submits `{ username, password }` via login form
3. `POST /api/public/auth/login` returns `{ success: true, data: { staff, token } }`
4. Backend sets httpOnly cookie `auth` with refresh token
5. Frontend stores access token + staff data in `useAuthStore`
6. Redirect to `/` (dashboard)

```typescript
// hooks/use-auth.ts
export function useLogin() {
    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (body: SignInBody) =>
            apiClient.post("/api/public/auth/login", body),
        onSuccess: async (result) => {
            if (result.success) {
                const { staff, token } = result.data;
                setAuth(token, staff, staff.role?.permissions ?? []);
                navigate({ to: "/" });
            }
        },
    });
}
```

### 2. App Boot — Silent Refresh

When the app loads, `__root.tsx` attempts to restore session via httpOnly cookie:

```typescript
// routes/__root.tsx beforeLoad
const { isAuthenticated } = useAuthStore.getState();
if (!isAuthenticated) {
    const result = await apiClient.post("/api/public/auth/refresh");
    if (result.success && result.data?.token) {
        const meResult = await apiClient.get("/api/public/auth/me");
        if (meResult.success) {
            useAuthStore.getState().setAuth(
                result.data.token,
                meResult.data,
                meResult.data.role?.permissions ?? [],
            );
        }
    }
}
```

### 3. Token Refresh on 401

Handled transparently in `api/client.ts`:
1. Any API call returns 401 → attempt `POST /api/public/auth/refresh`
2. If successful → update auth store, retry original request
3. If failed → clear auth, redirect to `/login`
4. Concurrent 401s share one refresh promise (prevent multiple refresh calls)

### 4. Logout

```typescript
export function useLogout() {
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiClient.post("/api/public/auth/logout"),
        onSettled: () => {
            clearAuth();
            queryClient.clear();
            navigate({ to: "/login" });
        },
    });
}
```

### 5. Permission-Based UI

```typescript
// hooks/use-permissions.ts
export function useHasPermission(permission: Permission): boolean {
    const permissions = useAuthStore((state) => state.permissions);
    return hasPermission(permissions, permission);
}

// Usage in components
const canCreate = useHasPermission(Permission.PRODUCTS_CREATE);
{canCreate && <Button onClick={navigateToNew}>{t("create")}</Button>}
```

## Frontend Conventions

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | `kebab-case.tsx` | `product-form.tsx` |
| Stores | `{domain}.store.ts` | `auth.store.ts` |
| API files | `{domain}.api.ts` | `products.api.ts` |
| Route files | TanStack convention | `$productId.tsx`, `_dashboard.tsx` |
| Tests | `{name}.test.ts(x)` | `product-form.test.tsx` |
| i18n | `{namespace}.json` | `products.json` |
| Hooks | `use-{name}.ts` | `use-permissions.ts` |

### Component Pattern

```typescript
// Named exports only — no default exports
export function ProductForm({ defaultValues, onSubmit, isLoading }: ProductFormProps) {
    // 1. Hooks
    const { t } = useTranslation("products");
    const form = useForm<CreateProductBodyType>({ ... });

    // 2. Derived state
    const isEditing = defaultValues !== undefined;

    // 3. Handlers
    function handleSubmit(data: CreateProductBodyType) {
        onSubmit(data);
    }

    // 4. Render
    return ( ... );
}
```

### Import Ordering

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

// 3. @jahonbozor/* packages
import { Permission, hasPermission } from "@jahonbozor/schemas";
import { Button, Input } from "@jahonbozor/ui";

// 4. Internal (@/ alias)
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

// 5. Types (with 'type' keyword)
import type { ProductFormProps } from "./types";
```

### Tailwind Conventions

- **Utility classes only** — no custom CSS files per component
- **`cn()`** for conditional classes: `cn("base-class", condition && "conditional-class")`
- **Mobile-first** responsive design: `sm:`, `md:`, `lg:`
- **No inline `style` attributes**
- **CSS variables** for theming (defined in `packages/ui/globals.css`)
- **No hardcoded colors** — use semantic tokens (`text-foreground`, `bg-background`, etc.)

### Animation (Motion)

Все фронтенд-приложения должны быть **интерактивными и приятными** в использовании. Для анимаций используем **Motion** (ранее framer-motion). Пакет установлен в `@jahonbozor/ui` и реэкспортирован оттуда.

```typescript
import { motion, AnimatePresence, LayoutGroup, PageTransition, AnimatedList, AnimatedListItem, FadeIn } from "@jahonbozor/ui";
```

#### Reusable Motion Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `PageTransition` | `@jahonbozor/ui` | Обёртка для контента страницы (fade-in + slide-up spring). Обязательно на каждой странице |
| `AnimatedList` + `AnimatedListItem` | `@jahonbozor/ui` | Контейнер со stagger-анимацией детей (40ms между элементами) |
| `FadeIn` | `@jahonbozor/ui` | Простой fade-in (opacity, optional `delay` prop) |

```typescript
// Каждая страница оборачивается в PageTransition
function ProductsPage() {
    return (
        <PageTransition className="p-6">
            <h1>{t("products")}</h1>
            {/* page content */}
        </PageTransition>
    );
}

// Списки используют AnimatedList для stagger-эффекта
<AnimatedList className="space-y-2">
    {items.map((item) => (
        <AnimatedListItem key={item.id}>
            <Card>{item.name}</Card>
        </AnimatedListItem>
    ))}
</AnimatedList>

// FadeIn для элементов без позиционного сдвига
<FadeIn delay={0.1}>
    <Badge>New</Badge>
</FadeIn>
```

#### Spring Config Reference

| Name | Config | Use |
|------|--------|-----|
| Snappy | `{ type: "spring", stiffness: 400, damping: 17 }` | `whileTap` на кнопках, быстрый press feedback |
| Smooth | `{ type: "spring", stiffness: 300, damping: 25 }` | Page transitions, form stagger, entrance animations |
| Balanced | `{ type: "spring", stiffness: 400, damping: 30 }` | Layout animations (nav pill slide, drawer) |

#### Gesture Animations

```typescript
// whileTap — обязательно на всех интерактивных элементах
<motion.button
    whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
    Click me
</motion.button>
```

#### Enter/Exit Animations

```typescript
// AnimatePresence для conditional renders
<AnimatePresence>
    {isVisible && (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
        >
            Content
        </motion.div>
    )}
</AnimatePresence>
```

#### Layout Animations

```typescript
// layoutId для sliding indicators (nav pills, tabs)
<LayoutGroup>
    {items.map((item) => (
        <Link key={item.to} to={item.to}>
            {isActive && (
                <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
            )}
            <span className="relative z-10">{item.label}</span>
        </Link>
    ))}
</LayoutGroup>
```

**Правила:**
- Импорт только из `@jahonbozor/ui` — **не** напрямую из `motion/react`
- **PageTransition** обязательна на каждой странице
- **whileTap** обязателен на всех кнопках и интерактивных элементах
- **AnimatePresence** обязателен для conditional renders (errors, toasts, modals)
- Spring-анимации по умолчанию (`type: "spring"`) для натуральности
- Простые CSS transitions (opacity, color) допустимы без Motion

#### Cursor Types

Глобальные правила курсора определены в `packages/ui/globals.css` и применяются автоматически:

| Cursor | Elements |
|--------|----------|
| `pointer` | `a`, `button`, `[role="button"]`, `[role="link"]`, `[role="tab"]`, `[role="menuitem"]`, `select`, `summary`, `label[for]`, `[role="checkbox"]`, `[role="radio"]`, `[role="switch"]`, `[role="option"]` |
| `text` | `input[type="text"]`, `input[type="password"]`, `textarea`, `input:not([type])` |
| `not-allowed` | `[disabled]`, `[aria-disabled="true"]` |

Не нужно добавлять `cursor-pointer` вручную — CSS применяет правильный курсор автоматически ко всем интерактивным элементам.

### Path Aliases

Both frontend apps use `@/` for own source and `@backend/` for backend type resolution (required by Eden Treaty):

```typescript
// tsconfig.app.json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["./src/*"],
            "@backend/lib/*": ["../../backend/src/lib/*"],
            "@backend/api/*": ["../../backend/src/api/*"],
            "@backend/generated/*": ["../../backend/src/generated/*"]
        }
    }
}

// vite.config.ts — only @/ needed at runtime (backend aliases are type-only)
resolve: {
    alias: {
        "@": path.resolve(__dirname, "./src"),
    },
}
```

> **Why `@backend/` aliases?** Eden Treaty follows the `type App` chain from `@jahonbozor/backend` through the backend's import graph. If TS can't resolve `@backend/lib/prisma`, `@backend/generated/prisma/client` etc., all Eden types degrade to `any`.

### TypeScript Checking with Project References

Frontend root `tsconfig.json` uses `"files": []` with project references. This means `bunx tsc --noEmit` (without `-p`) checks **nothing**. Always use:

```bash
bunx tsc --noEmit -p tsconfig.app.json
```

## Frontend Testing

> Full guide: [docs/frontend-testing.md](frontend-testing.md)

### Quick Overview

| Tool | Purpose |
|------|---------|
| `bun:test` | Test runner (matches backend) |
| `@testing-library/react` | Component rendering + queries |
| `@testing-library/user-event` | User interactions |
| `happy-dom` | DOM implementation |

### Test Priority

1. **Must:** Zustand stores, permission hooks, auth flow, API layer, i18n config
2. **Should:** Layout components, form validation, route guards
3. **Nice:** Domain components, table components

### Key Rules

- Run tests from `apps/frontend/admin/` or `apps/frontend/user/` (where `bunfig.toml` is)
- `mock.module()` **MUST** come BEFORE imports of the mocked module
- Reset Zustand stores in `beforeEach` via `setState()`
- Use `afterEach(() => { mock.restore() })` with `spyOn`
- Prefer semantic queries: `getByRole` > `getByLabelText` > `getByText` > `container.querySelector`

## Sentry Integration

### Backend

- `elysiajs-sentry` plugin — added conditionally when `SENTRY_DSN` env is set
- `requestId` tagged on every request via `Sentry.getCurrentScope().setTag("requestId", requestId)` in `request-context.ts`
- Error tracking with configurable `tracesSampleRate` (0.2 production, 1.0 development)

### Frontend

- `@sentry/react` integrated in both admin and user apps
- On login: `Sentry.setUser({ id: String(user.id), username: user.fullname })`
- On logout: `Sentry.setUser(null)`
- Integration points: `api/client.ts` (tryRefreshToken error tracking), `hooks/use-auth.ts` (login/logout user context)
