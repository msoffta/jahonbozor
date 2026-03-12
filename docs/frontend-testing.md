# Frontend Unit Testing

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Quick Commands

```bash
# IMPORTANT: Run from the specific frontend app directory!
cd apps/frontend/admin   # or apps/frontend/user

bun test                          # Run all tests
bun test --watch                  # Watch mode
bun test --coverage               # With coverage report
bun test --bail                   # Stop after first failure
bun test --test-name-pattern "X"  # Filter by test name
```

> **Note:** Tests must be run from `apps/frontend/admin/` or `apps/frontend/user/` where `bunfig.toml` is located. Running from monorepo root will skip the preload and mocks won't work.

## Test Structure

```
apps/frontend/{admin,user}/
├── test/
│   └── setup.ts                          # Preload: happy-dom + cleanup
├── bunfig.toml                           # Test configuration
└── src/
    ├── stores/__tests__/
    │   ├── auth.store.test.ts            # Auth store tests
    │   ├── cart.store.test.ts            # Cart store tests (user only)
    │   └── ui.store.test.ts             # UI store tests
    ├── api/__tests__/
    │   ├── auth.api.test.ts             # Auth API query options
    │   ├── client.test.ts               # API client + token refresh
    │   └── {domain}.api.test.ts         # Domain API tests
    ├── hooks/__tests__/
    │   ├── use-auth.test.ts             # Login/logout hooks
    │   └── use-permissions.test.ts      # Permission hooks
    ├── components/{layer}/__tests__/
    │   ├── header.test.tsx              # Layout component tests
    │   ├── bottom-nav.test.tsx          # Navigation tests
    │   └── product-card.test.tsx        # Domain component tests
    └── i18n/__tests__/
        └── config.test.ts              # i18n configuration tests
```

## Test Setup (happy-dom)

### bunfig.toml

```toml
# apps/frontend/*/bunfig.toml
[test]
preload = ["./test/setup.ts"]
coverageSkipTestFiles = true
coveragePathIgnorePatterns = ["src/routeTree.gen.ts", "src/i18n/**"]
```

### test/setup.ts

```typescript
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
});
```

> **IMPORTANT:** `GlobalRegistrator.register()` must be called BEFORE any `@testing-library/react` imports. The `afterEach(cleanup)` prevents DOM state leaking between tests.

## Zustand Store Testing

Stores are tested without rendering React components — call actions via `getState()`, assert state via `getState()`.

### Store Reset Pattern

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { useCartStore } from "../cart.store";

describe("Cart Store", () => {
    // Reset to initial state before each test
    beforeEach(() => {
        useCartStore.setState({ items: [] });
    });

    test("should add new item with quantity 1", () => {
        useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });

        const items = useCartStore.getState().items;
        expect(items).toHaveLength(1);
        expect(items[0]).toEqual({ productId: 1, name: "Test", price: 100, quantity: 1 });
    });
});
```

### Testing Derived Values (Computed)

```typescript
describe("totalItems", () => {
    test("should return sum of all quantities", () => {
        useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
        useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 }); // quantity → 2
        useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 }); // new item

        expect(useCartStore.getState().totalItems()).toBe(3);
    });

    test("should return 0 for empty cart", () => {
        expect(useCartStore.getState().totalItems()).toBe(0);
    });
});
```

### DO / DON'T

| DO | DON'T |
|----|-------|
| Reset state in `beforeEach` with `setState()` | Rely on state from previous tests |
| Test all actions + derived getters + edge cases | Mock Zustand's `create` — test the real store |
| Test boundary values (quantity=0, negative) | Skip edge cases for "simple" stores |

## Hook Testing with renderHook

Use `renderHook()` from `@testing-library/react` for hooks that use React features (other hooks, context, re-renders).

### Basic Pattern (Stateless Hooks)

```typescript
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "../../stores/auth.store";
import { useHasPermission } from "../use-permissions";
import { Permission } from "@jahonbozor/schemas";

beforeEach(() => {
    useAuthStore.setState({
        token: null, user: null, permissions: [], isAuthenticated: false,
    });
});

test("should return true when user has the permission", () => {
    useAuthStore.setState({ permissions: [Permission.PRODUCTS_LIST] });
    const { result } = renderHook(() => useHasPermission(Permission.PRODUCTS_LIST));
    expect(result.current).toBe(true);
});

test("should return false when permissions are empty", () => {
    useAuthStore.setState({ permissions: [] });
    const { result } = renderHook(() => useHasPermission(Permission.PRODUCTS_LIST));
    expect(result.current).toBe(false);
});
```

### Async Hooks with Mutations

For hooks that use `useMutation` or other async operations, wrap in `act(async () => { ... })`:

```typescript
import { renderHook, act } from "@testing-library/react";

test("should set auth on successful login", async () => {
    mockLoginPost.mockResolvedValueOnce({
        data: { success: true, data: { staff: { id: 1, fullname: "Admin" }, token: "jwt-token" } },
        error: null,
    });

    const { result } = renderHook(() => useLogin());
    await act(async () => {
        await result.current.mutate({ username: "admin", password: "password" });
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe("jwt-token");
    expect(state.isAuthenticated).toBe(true);
});
```

## Component Testing

### Basic Rendering + Queries

```typescript
import { render, fireEvent } from "@testing-library/react";

test("should render product name", () => {
    const { getByText } = render(<ProductCard id={1} name="Test Product" price={50000} remaining={10} />);
    expect(getByText("Test Product")).toBeDefined();
});
```

### User Interactions + Store Integration

Test that component interactions correctly update the Zustand store:

```typescript
test("should add item to cart on button click", () => {
    const { getByRole } = render(<ProductCard id={5} name="Product A" price={1000} remaining={10} />);

    const button = getByRole("button", { name: "add_to_cart" });
    fireEvent.click(button);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
        productId: 5,
        name: "Product A",
        price: 1000,
        quantity: 1,
    });
});
```

### Testing Conditional Rendering

Set store state BEFORE render to test different UI states:

```typescript
test("should show quantity control after adding to cart", () => {
    useCartStore.setState({
        items: [{ productId: 5, name: "Product A", price: 1000, quantity: 1 }],
    });

    const { getByText, getAllByRole } = render(
        <ProductCard id={5} name="Product A" price={1000} remaining={10} />,
    );

    expect(getByText("1")).toBeDefined();
    const buttons = getAllByRole("button");
    expect(buttons.length).toBe(2); // minus and plus
});
```

### fireEvent vs userEvent

| `fireEvent` | `userEvent.setup()` |
|-------------|---------------------|
| Simpler, synchronous | More realistic, async |
| Good for simple click/change | Better for typing, focus, sequential interactions |
| Used in existing tests | Recommended for new tests with complex interactions |

```typescript
// fireEvent (simple)
fireEvent.click(button);

// userEvent (realistic — includes focus, mousedown, mouseup, click)
const user = userEvent.setup();
await user.click(button);
await user.type(input, "Hello");
```

## Mocking Patterns

### CRITICAL: mock.module() Ordering

`mock.module()` calls **MUST** come BEFORE imports of modules that use the mocked dependency:

```typescript
// ✅ CORRECT — mock BEFORE import
mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import { Header } from "../header";  // Header uses @tanstack/react-router

// ❌ WRONG — mock AFTER import (mock won't take effect)
import { Header } from "../header";
mock.module("@tanstack/react-router", () => ({ Link: ... }));
```

### @tanstack/react-router

```typescript
mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>{children}</a>
    ),
    useNavigate: () => mockNavigate,
}));
```

### @tanstack/react-query (useMutation mock)

```typescript
mock.module("@tanstack/react-query", () => ({
    useMutation: ({ mutationFn, onSuccess, onSettled }: any) => ({
        mutate: async (body: any) => {
            try {
                const result = await mutationFn(body);
                if (onSuccess) await onSuccess(result);
            } catch {
                // error handling
            }
            if (onSettled) onSettled();
        },
        mutateAsync: mutationFn,
        isPending: false,
        isError: false,
    }),
    useQueryClient: () => ({
        clear: mockQueryClientClear,
    }),
}));
```

### Eden Treaty API client

```typescript
const mockGet = mock(() => Promise.resolve({ data: { success: true, data: { id: 1 } }, error: null }));
const mockPost = mock(() => Promise.resolve({ data: { success: true, data: {} }, error: null }));

mock.module("@/api/client", () => ({
    api: {
        api: {
            public: {
                auth: {
                    login: { post: mockPost },
                    logout: { post: mockPost },
                    me: { get: mockGet },
                },
            },
        },
    },
}));
```

> **Note:** The mock structure must match the Eden Treaty path: `api.api.public.auth.login.post(body)`.

### @jahonbozor/ui (Motion + UI components)

```typescript
mock.module("@jahonbozor/ui", () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input type="checkbox" checked={checked}
               onChange={(e: any) => onCheckedChange?.(e.target.checked)} {...props} />
    ),
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
```

> **Why mock Motion?** happy-dom doesn't support Web Animations API. Mock `motion.*` as plain HTML elements and `AnimatePresence` as a passthrough.

### react-i18next

```typescript
mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
```

> **Note:** `t(key)` returns the key as-is, so assertions use translation keys: `expect(getByText("add_to_cart")).toBeDefined()`.

### @sentry/react

```typescript
const mockSentrySetUser = mock(() => {});
mock.module("@sentry/react", () => ({
    setUser: mockSentrySetUser,
}));
```

### fetch API (spyOn)

```typescript
import { spyOn, afterEach, mock } from "bun:test";

afterEach(() => {
    mock.restore();  // Restore spyOn mocks
});

test("should refresh token", async () => {
    const fetchMock = spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { token: "new-token" } }),
    } as Response);

    const { tryRefreshToken } = await import("@/api/client");
    const result = await tryRefreshToken();
    expect(result).toBe(true);
});
```

> **IMPORTANT:** Always use `afterEach(() => { mock.restore() })` when using `spyOn` to prevent leaking between tests.

## Testing Library Query Priority

Prefer semantic queries that reflect how users interact with the UI:

| Priority | Query | When to use |
|----------|-------|-------------|
| 1 | `getByRole("button", { name: "..." })` | Buttons, links, headings, checkboxes |
| 2 | `getByLabelText("...")` | Form fields with labels |
| 3 | `getByPlaceholderText("...")` | Inputs without labels (fallback) |
| 4 | `getByText("...")` | Non-interactive text content |
| 5 | `getByAltText("...")` | Images with alt text |
| 6 | `getByDisplayValue("...")` | Pre-filled form inputs |
| Last resort | `container.querySelector("...")` | No semantic alternative |

```typescript
// ✅ Prefer semantic queries
getByRole("button", { name: "add_to_cart" })
getByAltText("Jahon Bozor")
getByText("Test Product")

// ❌ Avoid when a semantic query is available
container.querySelector(".add-button")
container.querySelectorAll("a")
```

## API Layer Testing

Test query keys, query options, and `enabled` conditions:

```typescript
import { useAuthStore } from "@/stores/auth.store";

describe("profileOptions", () => {
    test("should have correct queryKey", () => {
        const options = profileOptions();
        expect([...options.queryKey]).toEqual(["auth", "me"]);
    });

    test("should be disabled when not authenticated", () => {
        const options = profileOptions();
        expect(options.enabled).toBe(false);
    });

    test("should be enabled when authenticated", () => {
        useAuthStore.getState().login("token", { id: 1, name: "Test", ... });
        const options = profileOptions();
        expect(options.enabled).toBe(true);
    });
});
```

## Test Coverage Requirements

### Store Tests

- All actions (addItem, removeItem, updateQuantity, clearCart, etc.)
- All derived/computed values (totalItems, totalPrice)
- Edge cases: empty state, duplicate items, non-existent items
- Boundary values: quantity=0, negative quantity

### Hook Tests

- Return values for different store states (permissions present/absent/empty)
- Side effects: store mutations, navigation, API calls, Sentry user tracking
- Error scenarios: API failure, network error, missing data
- Edge cases: empty permissions array, null role

### Component Tests

- Rendering with different props
- User interactions → store mutations
- Conditional rendering based on store state
- Formatted values (prices, counts)

### API Tests

- Query keys and options correctness
- `enabled` conditions based on auth state
- Token refresh flow (success, failure, network error)
- Auth header injection

## Best Practices

### DO

- Reset Zustand stores in `beforeEach` via `setState()`
- Place `mock.module()` calls BEFORE imports
- Use `afterEach(() => { mock.restore() })` with `spyOn`
- Test the integration: component click → store update
- Use `mock.restore()` in `beforeEach` when re-importing modules
- Use semantic Testing Library queries (`getByRole`, `getByText`)
- Test the same store across different test files independently (each resets)

### DON'T

- Rely on state from previous tests
- Mock Zustand's `create` function — test the real store
- Import modules BEFORE their `mock.module()` calls
- Leave `.only` in committed tests
- Use `container.querySelector` when a semantic query is available
- Test third-party library internals (React Query caching, Zustand middleware)
- Skip `cleanup()` — it's in `test/setup.ts` but never remove it

## Mock Consistency and Isolation (Bun-specific)

### Critical: Bun Test Isolation Issue

Unlike Vitest/Jest, Bun's `mock.module` patches the module cache at runtime and affects ALL subsequent tests globally. Mocks are NOT isolated between test files.

**Solution**: Use centralized mocks from `apps/frontend/admin/src/test-utils/ui-mocks.tsx`

### Using Centralized UI Mocks

```typescript
import { setupUIMocks } from "../test-utils/ui-mocks";

// At top of test file, before component imports
setupUIMocks();

import { MyComponent } from "../my-component";
```

This replaces inline `mock.module()` declarations for:
- `motion/react` - motion components and AnimatePresence
- `@jahonbozor/ui` - all UI components (Input, Button, Table*, Select*, Tooltip*, DropdownMenu*, etc.)

### Mock Module Ordering (CRITICAL)

Always follow this order to prevent conflicts:

1. `setupUIMocks()` call (or inline mock.module calls)
2. Component imports (MUST be after mocks)

**Why?** Bun doesn't hoist mocks like Jest. Module cache is patched at runtime when mock.module executes.

```typescript
// ✅ CORRECT
mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

setupUIMocks();  // Centralized mocks for motion/react and @jahonbozor/ui

import { MyComponent } from "../my-component";

// ❌ WRONG — import before mocks
import { MyComponent } from "../my-component";
setupUIMocks();  // Too late! Module already loaded
```

### Extending Centralized Mocks

For tests requiring additional component-specific mocks:

```typescript
import { setupUIMocks } from "../test-utils/ui-mocks";

// Setup centralized UI mocks first
setupUIMocks();

// Extend with additional mocks specific to this test
mock.module("@jahonbozor/ui", () => ({
    ...require("../test-utils/ui-mocks").uiMocks,
    LayoutGroup: ({ children }: any) => <>{children}</>,
}));

import { MyComponent } from "../my-component";
```

### Prop Filtering

All centralized mocks automatically filter:
- **Motion props**: whileTap, whileHover, initial, animate, exit, etc.
- **Radix props**: asChild
- **Other framework props**: Custom component props that shouldn't reach DOM

This prevents React warnings: "React does not recognize the `whileTap` prop on a DOM element"

### Centralized Mocks Contents

The `ui-mocks.tsx` file includes:
- **Input**: Supports both controlled and uncontrolled modes with proper state management
- **Button**: Filters asChild and motion props
- **Table components**: Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- **Select components**: Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- **Tooltip components**: Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
- **Checkbox**: Standard checkbox with onCheckedChange callback
- **DropdownMenu components**: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
- **Motion**: Proxied motion.* components with prop filtering
- **AnimatePresence**: Passthrough wrapper
- **DataTableNewRow**: Simplified mock for multi-row tests

### When NOT to Use Centralized Mocks

Keep component-specific mocks when:
- Test requires module-specific behavior (e.g., react-router, react-query, react-i18next)
- Test needs special test doubles (spies with mockResolvedValue, etc.)
- Component has unique requirements not covered by centralized mocks

```typescript
// Component-specific mocks alongside centralized mocks
mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useRouterState: ({ select }: any) => select({ location: { pathname: "/" } }),
}));

setupUIMocks();  // Centralized mocks for UI components

import { MyComponent } from "../my-component";
```
