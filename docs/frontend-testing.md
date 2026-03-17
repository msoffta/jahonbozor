# Frontend Unit Testing

> See [CLAUDE.md](../CLAUDE.md) for core project rules and quick reference.

## Quick Commands

### UI Package (packages/ui)

```bash
bun run test:ui                      # Run all UI package tests
bun run test:ui -- --watch           # Watch mode
```

### Frontend Apps (admin/user)

```bash
bun run test:admin                   # Run admin tests
bun run test:user                    # Run user tests
bun run test:admin -- --watch        # Watch mode
bun run test:admin -- --coverage     # With coverage report
```

## Test Structure

```
apps/frontend/{admin,user}/
├── test/
│   └── setup.ts                          # Setup: cleanup
├── vitest.config.ts                      # Vitest configuration
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

packages/ui/
├── test/
│   └── setup.ts                          # Setup: cleanup
├── vitest.config.ts                      # Vitest configuration
└── src/
    └── components/
        └── data-table/__tests__/
            ├── data-table.test.tsx               # DataTable component
            ├── data-table-new-row.test.tsx       # New row functionality
            └── data-table-multi-new-rows.test.tsx # Multi-row functionality
```

## UI Package Testing (packages/ui)

### Overview

UI package тестирует shared компоненты (DataTable, motion, shadcn/ui) изолированно от приложений.

**Current Coverage:**

- DataTable components (45 tests covering all scenarios)

### Key Points

1. **Real Components:** НЕ мокируем Input — используем реальные компоненты из `packages/ui`
2. **userEvent:** Используем `userEvent.setup()` + `userEvent.type()` для взаимодействий
3. **React in devDependencies:** UI package требует `react` и `react-dom` в devDependencies для тестов

### Example Test

```typescript
import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataTableNewRow } from "../data-table-new-row";

test("should update value on input change", async () => {
    const user = userEvent.setup();
    const { container } = render(<DataTableNewRow {...props} />);
    const input = container.querySelector("input")!;

    await user.type(input, "Test");

    expect(input.value).toBe("Test");
});
```

## Test Setup

### vitest.config.ts

```typescript
// apps/frontend/{admin,user}/vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "happy-dom",
            setupFiles: ["./test/setup.ts"],
            mockReset: true,
        },
    }),
);
```

### test/setup.ts

```typescript
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
});
```

> **Note:** `cleanup()` prevents DOM state leaking between tests. `mockReset: true` in config handles mock cleanup automatically.

## Zustand Store Testing

Stores are tested without rendering React components — call actions via `getState()`, assert state via `getState()`.

### Store Reset Pattern

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart.store";

describe("Cart Store", () => {
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
        useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 }); // quantity -> 2
        useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 }); // new item

        expect(useCartStore.getState().totalItems()).toBe(3);
    });

    test("should return 0 for empty cart", () => {
        expect(useCartStore.getState().totalItems()).toBe(0);
    });
});
```

### DO / DON'T

| DO                                              | DON'T                                         |
| ----------------------------------------------- | --------------------------------------------- |
| Reset state in `beforeEach` with `setState()`   | Rely on state from previous tests             |
| Test all actions + derived getters + edge cases | Mock Zustand's `create` — test the real store |
| Test boundary values (quantity=0, negative)     | Skip edge cases for "simple" stores           |

## Hook Testing with renderHook

Use `renderHook()` from `@testing-library/react` for hooks that use React features.

### Basic Pattern (Stateless Hooks)

```typescript
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "../../stores/auth.store";
import { useHasPermission } from "../use-permissions";
import { Permission } from "@jahonbozor/schemas";

beforeEach(() => {
    useAuthStore.setState({
        token: null,
        user: null,
        permissions: [],
        isAuthenticated: false,
    });
});

test("should return true when user has the permission", () => {
    useAuthStore.setState({ permissions: [Permission.PRODUCTS_LIST] });
    const { result } = renderHook(() => useHasPermission(Permission.PRODUCTS_LIST));
    expect(result.current).toBe(true);
});
```

### Async Hooks with Mutations

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
import { render } from "@testing-library/react";

test("should render product name", () => {
    const { getByText } = render(<ProductCard id={1} name="Test Product" price={50000} remaining={10} />);
    expect(getByText("Test Product")).toBeDefined();
});
```

### User Interactions + Store Integration

```typescript
import { fireEvent } from "@testing-library/react";

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

| `fireEvent`                  | `userEvent.setup()`                               |
| ---------------------------- | ------------------------------------------------- |
| Simpler, synchronous         | More realistic, async                             |
| Good for simple click/change | Better for typing, focus, sequential interactions |
|                              | Recommended for new tests                         |

```typescript
// fireEvent (simple)
fireEvent.click(button);

// userEvent (realistic — includes focus, mousedown, mouseup, click)
const user = userEvent.setup();
await user.click(button);
await user.type(input, "Hello");
```

## Mocking Patterns

### vi.mock() is Hoisted Automatically

Unlike Bun's `mock.module()`, Vitest's `vi.mock()` is automatically hoisted to the top of the file. **Import order doesn't matter:**

```typescript
// This works — vi.mock is hoisted above the import automatically
import { vi } from "vitest";
import { Header } from "../header";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => mockNavigate,
}));
```

### @tanstack/react-router

```typescript
vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>{children}</a>
    ),
    useNavigate: () => mockNavigate,
}));
```

### @tanstack/react-query (useMutation mock)

```typescript
vi.mock("@tanstack/react-query", () => ({
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
const mockGet = vi.fn(() =>
    Promise.resolve({ data: { success: true, data: { id: 1 } }, error: null }),
);
const mockPost = vi.fn(() => Promise.resolve({ data: { success: true, data: {} }, error: null }));

vi.mock("@/api/client", () => ({
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

### motion/react (Animation mocking)

```typescript
import { createElement } from "react";

vi.mock("motion/react", () => ({
    motion: new Proxy({}, {
        get: (_target: any, prop: string) => {
            return ({ children, className, ...rest }: any) =>
                createElement(prop, { className }, children);
        },
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    LayoutGroup: ({ children }: any) => <>{children}</>,
}));
```

> **Why mock Motion?** happy-dom doesn't support Web Animations API. Mock `motion.*` as plain HTML elements.

### @jahonbozor/ui

```typescript
vi.mock("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    Button: ({ children, className, disabled, onClick, type, ...props }: any) => (
        <button className={className} disabled={disabled} onClick={onClick} type={type || "button"}>
            {children}
        </button>
    ),
    Input: ({ className, ...props }: any) => <input className={className} {...props} />,
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input type="checkbox" checked={checked}
               onChange={(e: any) => onCheckedChange?.(e.target.checked)} />
    ),
    PageTransition: ({ children }: any) => <>{children}</>,
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```

### Shared UI Mock Factories

Вместо `setupUIMocks()` (Bun-специфичная церемония), экспортируем фабрики:

```typescript
// test-utils/ui-mocks.ts — exports mock objects (no vi.mock calls)
export const motionMocks = {
    motion: new Proxy({}, { /* ... */ }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
};

export const uiMocks = {
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Input: (props: any) => <input {...props} />,
    // ... other components
};

// In test file — vi.mock is hoisted, order doesn't matter:
import { motionMocks, uiMocks } from "../test-utils/ui-mocks";

vi.mock("motion/react", () => motionMocks);
vi.mock("@jahonbozor/ui", () => uiMocks);
```

### react-i18next

```typescript
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
```

> **Note:** `t(key)` returns the key as-is, so assertions use translation keys: `expect(getByText("add_to_cart")).toBeDefined()`.

### @sentry/react

```typescript
const mockSentrySetUser = vi.fn();
vi.mock("@sentry/react", () => ({
    setUser: mockSentrySetUser,
}));
```

### fetch API (spyOn)

```typescript
import { vi, afterEach } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
});

test("should refresh token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { token: "new-token" } }),
    } as Response);

    const { tryRefreshToken } = await import("@/api/client");
    const result = await tryRefreshToken();
    expect(result).toBe(true);
});
```

### vi.hoisted() for Shared Mock Variables

When mock variables need to be accessible both in mock factories and tests:

```typescript
const mocks = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
}));

vi.mock("@/api/client", () => ({
    api: { api: { public: { auth: { login: { post: mocks.mockPost } } } } },
}));

test("calls login", () => {
    mocks.mockPost.mockResolvedValueOnce({ data: { success: true } });
    // ...
});
```

## Testing Library Query Priority

Prefer semantic queries that reflect how users interact with the UI:

| Priority    | Query                                  | When to use                          |
| ----------- | -------------------------------------- | ------------------------------------ |
| 1           | `getByRole("button", { name: "..." })` | Buttons, links, headings, checkboxes |
| 2           | `getByLabelText("...")`                | Form fields with labels              |
| 3           | `getByPlaceholderText("...")`          | Inputs without labels (fallback)     |
| 4           | `getByText("...")`                     | Non-interactive text content         |
| 5           | `getByAltText("...")`                  | Images with alt text                 |
| 6           | `getByDisplayValue("...")`             | Pre-filled form inputs               |
| Last resort | `container.querySelector("...")`       | No semantic alternative              |

```typescript
// Prefer semantic queries
getByRole("button", { name: "add_to_cart" });
getByAltText("Jahon Bozor");
getByText("Test Product");

// Avoid when a semantic query is available
container.querySelector(".add-button");
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
        useAuthStore.getState().login("token", { id: 1, name: "Test" });
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
- User interactions -> store mutations
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
- Use `vi.mock()` for module mocking (hoisted automatically)
- Use `afterEach(() => { vi.restoreAllMocks() })` with `vi.spyOn`
- Test the integration: component click -> store update
- Use semantic Testing Library queries (`getByRole`, `getByText`)
- Test the same store across different test files independently
- Use `waitFor()` for async state updates

### DON'T

- Don't rely on state from previous tests
- Don't mock Zustand's `create` function — test the real store
- Don't leave `.only` in committed tests
- Don't use `container.querySelector` when a semantic query is available
- Don't test third-party library internals (React Query caching, Zustand middleware)
- Don't skip `cleanup()` — it's in `test/setup.ts` but never remove it
- Don't use `as any` in mock return values when type-safe alternatives exist

> Full backend testing guide: [docs/testing.md](testing.md)
