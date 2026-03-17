import { describe, test, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    categoriesData: undefined as { categories: Array<{ id: number; name: string }> } | undefined,
    categoriesLoading: false,
    searchData: undefined as { products: Array<{ id: number; name: string; price: number; remaining: number }> } | undefined,
    searchLoading: false,
}));

vi.mock("@/lib/api-client", () => ({
    api: { api: { public: { products: { get: vi.fn() }, categories: { get: vi.fn() }, auth: { me: { get: vi.fn() }, logout: { post: vi.fn() } }, users: { telegram: { post: vi.fn() }, language: { put: vi.fn() } }, orders: Object.assign(() => ({ get: vi.fn(), cancel: { patch: vi.fn() } }), { get: vi.fn(), post: vi.fn() }) } } },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params) return `${key}_${JSON.stringify(params)}`;
            return key;
        },
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (config: any) => config,
    lazyRouteComponent: (component: any) => component,
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>{children}</a>
    ),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: (options: any) => {
        const key = JSON.stringify(options?.queryKey ?? []);
        if (key.includes("categories")) {
            return { data: mocks.categoriesData, isLoading: mocks.categoriesLoading };
        }
        return { data: mocks.searchData, isLoading: mocks.searchLoading };
    },
    useInfiniteQuery: () => ({ data: undefined, isLoading: false, isFetchingNextPage: false, hasNextPage: false, fetchNextPage: vi.fn() }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    queryOptions: (opts: any) => opts,
    infiniteQueryOptions: (opts: any) => opts,
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

vi.mock("@/api/products.api", () => ({
    productKeys: { all: ["products"], lists: () => ["products", "list"], details: () => ["products", "detail"], detail: (id: number) => ["products", "detail", id] },
    productsListOptions: (params: any) => ({ queryKey: ["products", params] }),
    productsInfiniteOptions: (params: any) => ({ queryKey: ["products", "list", params] }),
    productDetailOptions: (id: number) => ({ queryKey: ["products", "detail", id] }),
}));

vi.mock("@/api/categories.api", () => ({
    categoryKeys: { all: ["categories"], list: () => ["categories", "list"], detail: (id: number) => ["categories", "detail", id] },
    categoriesListOptions: () => ({ queryKey: ["categories"] }),
}));

vi.mock("@/components/catalog/search-bar", () => ({
    SearchBar: ({ value, onChange }: any) => (
        <div data-testid="search-bar">
            <input
                data-testid="search-input"
                defaultValue={value}
                onChange={(e: any) => onChange(e.target.value)}
                placeholder="search"
            />
            <button data-testid="trigger-search" onClick={() => onChange("search-query")}>
                Search
            </button>
        </div>
    ),
}));

vi.mock("@/components/catalog/category-section", () => ({
    CategorySection: ({ categoryId, categoryName }: any) => (
        <div data-testid={`category-section-${categoryId}`}>{categoryName}</div>
    ),
}));

vi.mock("@/components/catalog/product-card", () => ({
    ProductCard: ({ productId, name }: any) => (
        <div data-testid={`product-card-${productId}`}>{name}</div>
    ),
}));

import { render, fireEvent } from "@testing-library/react";
import { Route } from "../index";

const HomePage = (Route as any).component ?? (Route as any).options?.component;

describe("HomePage", () => {
    beforeEach(() => {
        mocks.categoriesData = undefined;
        mocks.categoriesLoading = false;
        mocks.searchData = undefined;
        mocks.searchLoading = false;
    });

    test("should render search bar", () => {
        const { getByTestId } = render(<HomePage />);
        expect(getByTestId("search-bar")).toBeDefined();
    });

    test("should render categories when loaded", () => {
        mocks.categoriesData = {
            categories: [
                { id: 1, name: "Electronics" },
                { id: 2, name: "Clothing" },
            ],
        };

        const { getByTestId, getByText } = render(<HomePage />);
        expect(getByTestId("category-section-1")).toBeDefined();
        expect(getByTestId("category-section-2")).toBeDefined();
        expect(getByText("Electronics")).toBeDefined();
        expect(getByText("Clothing")).toBeDefined();
    });

    test("should show loading skeletons when categories are loading", () => {
        mocks.categoriesLoading = true;

        const { getAllByTestId } = render(<HomePage />);
        expect(getAllByTestId("skeleton").length).toBeGreaterThan(0);
    });

    test("should show no_data when search returns empty", () => {
        mocks.searchData = { products: [] };
        mocks.searchLoading = false;

        const { getByTestId, getByText } = render(<HomePage />);
        fireEvent.click(getByTestId("trigger-search"));

        expect(getByText("no_data")).toBeDefined();
    });

    test("should render search results when searching", () => {
        mocks.searchData = {
            products: [
                { id: 10, name: "Found Product", price: 5000, remaining: 3 },
                { id: 11, name: "Another Product", price: 8000, remaining: 7 },
            ],
        };
        mocks.searchLoading = false;

        const { getByTestId, getByText } = render(<HomePage />);
        fireEvent.click(getByTestId("trigger-search"));

        expect(getByTestId("product-card-10")).toBeDefined();
        expect(getByTestId("product-card-11")).toBeDefined();
        expect(getByText("Found Product")).toBeDefined();
        expect(getByText("Another Product")).toBeDefined();
    });

    test("should render inside PageTransition", () => {
        const { getByTestId } = render(<HomePage />);
        expect(getByTestId("page-transition")).toBeDefined();
    });
});
