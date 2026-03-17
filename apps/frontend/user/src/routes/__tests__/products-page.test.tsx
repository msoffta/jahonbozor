import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockProducts, mockCategories, mocks } = vi.hoisted(() => {
    const mockProducts = [
        { id: 1, name: "Apple", price: 5000, remaining: 100 },
        { id: 2, name: "Banana", price: 3000, remaining: 50 },
        { id: 3, name: "Cherry", price: 8000, remaining: 25 },
    ];

    const mockCategories = [
        { id: 1, name: "Fruits", children: [{ id: 11, name: "Citrus" }] },
        { id: 2, name: "Vegetables", children: [] },
        { id: 3, name: "Dairy", children: [] },
        { id: 4, name: "Meat", children: [] },
    ];

    return {
        mockProducts,
        mockCategories,
        mocks: {
            infiniteQueryReturn: {
                data: { pages: [{ products: mockProducts }] },
                isLoading: false,
                isFetchingNextPage: false,
                hasNextPage: false,
                fetchNextPage: vi.fn(),
            } as any,
            queryReturn: {
                data: { categories: mockCategories },
                isLoading: false,
            } as any,
        },
    };
});

vi.mock("@/lib/api-client", () => ({
    api: { api: { public: { products: { get: vi.fn() }, categories: { get: vi.fn() } } } },
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
    createFileRoute: () => (config: any) => ({
        ...config,
        useSearch: () => ({}),
    }),
    lazyRouteComponent: (component: any) => component,
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useInfiniteQuery: () => mocks.infiniteQueryReturn,
    useQuery: () => mocks.queryReturn,
    queryOptions: (opts: any) => opts,
    infiniteQueryOptions: (opts: any) => opts,
}));

vi.mock("@/api/products.api", () => ({
    productKeys: { all: ["products"], lists: () => ["products", "list"], details: () => ["products", "detail"], detail: (id: number) => ["products", "detail", id] },
    productsListOptions: (params: any) => ({ queryKey: ["products", "list", params] }),
    productsInfiniteOptions: (params: any) => ({ queryKey: ["products", "list", params] }),
    productDetailOptions: (id: number) => ({ queryKey: ["products", "detail", id] }),
}));

vi.mock("@/api/categories.api", () => ({
    categoryKeys: { all: ["categories"], list: () => ["categories", "list"], detail: (id: number) => ["categories", "detail", id] },
    categoriesListOptions: () => ({ queryKey: ["categories", "list"] }),
}));

vi.mock("@/components/catalog/search-bar", () => ({
    SearchBar: ({ value, onChange }: any) => (
        <input
            data-testid="search-bar"
            value={value || ""}
            onChange={(e: any) => onChange(e.target.value)}
            placeholder="search"
        />
    ),
}));

vi.mock("@/components/catalog/product-card", () => ({
    ProductCard: ({ name, price, remaining }: any) => (
        <div data-testid="product-card">
            <span>{name}</span>
            {price != null && <span data-testid="card-price">{price}</span>}
            {remaining != null && <span data-testid="card-remaining">{remaining}</span>}
        </div>
    ),
}));

vi.mock("@/components/layout/page-header", () => ({
    PageHeader: ({ crumbs }: any) => (
        <nav data-testid="page-header">
            {crumbs.map((c: any, i: number) => (
                <span key={i}>{c.label}</span>
            ))}
        </nav>
    ),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

import { render } from "@testing-library/react";
import { Route } from "../_public/products/index";

const ProductsPage = (Route as any).component ?? (Route as any).options?.component;

describe("ProductsPage", () => {
    beforeEach(() => {
        mocks.infiniteQueryReturn = {
            data: { pages: [{ products: mockProducts }] },
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        };
        mocks.queryReturn = {
            data: { categories: mockCategories },
            isLoading: false,
        };
    });

    test("should render search bar", () => {
        const { getByTestId } = render(<ProductsPage />);
        expect(getByTestId("search-bar")).toBeDefined();
    });

    test("should render category filter buttons", () => {
        const { getByText } = render(<ProductsPage />);
        expect(getByText("all")).toBeDefined();
        expect(getByText("Fruits")).toBeDefined();
        expect(getByText("Vegetables")).toBeDefined();
        expect(getByText("Dairy")).toBeDefined();
    });

    test("should render more button when categories exceed visible count", () => {
        const { container } = render(<ProductsPage />);
        const moreButton = container.querySelector("[aria-label='more']");
        expect(moreButton).toBeDefined();
        expect(moreButton).not.toBeNull();
    });

    test("should not render more button when categories are within visible count", () => {
        mocks.queryReturn = {
            data: {
                categories: [
                    { id: 1, name: "Fruits", children: [] },
                    { id: 2, name: "Vegetables", children: [] },
                ],
            },
            isLoading: false,
        };

        const { container } = render(<ProductsPage />);
        const moreButton = container.querySelector("[aria-label='more']");
        expect(moreButton).toBeNull();
    });

    test("should render products list", () => {
        const { getAllByTestId } = render(<ProductsPage />);
        const cards = getAllByTestId("product-card");
        expect(cards.length).toBe(3);
    });

    test("should render product names", () => {
        const { getByText } = render(<ProductsPage />);
        expect(getByText("Apple")).toBeDefined();
        expect(getByText("Banana")).toBeDefined();
        expect(getByText("Cherry")).toBeDefined();
    });

    test("should show loading skeletons when loading", () => {
        mocks.infiniteQueryReturn = {
            data: undefined,
            isLoading: true,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        };

        const { getAllByTestId } = render(<ProductsPage />);
        const skeletons = getAllByTestId("skeleton");
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    test("should show no_data when products list is empty", () => {
        mocks.infiniteQueryReturn = {
            data: { pages: [{ products: [] }] },
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        };

        const { getByText } = render(<ProductsPage />);
        expect(getByText("no_data")).toBeDefined();
    });

    test("should render page header with breadcrumbs", () => {
        const { getByTestId, getByText } = render(<ProductsPage />);
        expect(getByTestId("page-header")).toBeDefined();
        expect(getByText("home")).toBeDefined();
        expect(getByText("products")).toBeDefined();
    });

    test("should not render category buttons when no categories", () => {
        mocks.queryReturn = {
            data: { categories: [] },
            isLoading: false,
        };

        const { queryByText } = render(<ProductsPage />);
        expect(queryByText("all")).toBeNull();
    });

    test("should not show fetching next page spinner when not fetching", () => {
        const { container } = render(<ProductsPage />);
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeNull();
    });
});
