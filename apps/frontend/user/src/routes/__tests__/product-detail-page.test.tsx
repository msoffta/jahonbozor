import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockNavigate, mocks } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mocks: {
        queryReturn: {
            data: {
                id: 1,
                name: "Test Product",
                price: 15000,
                remaining: 50,
                category: {
                    id: 10,
                    name: "Fruits",
                    parent: { id: 5, name: "Food" },
                },
            },
            isLoading: false,
        } as any,
    },
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: { public: { products: Object.assign(() => ({ get: vi.fn() }), { get: vi.fn() }) } },
    },
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
        useParams: () => ({ productId: "1" }),
    }),
    lazyRouteComponent: (component: any) => component,
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => mockNavigate,
    useRouter: () => ({ history: { back: vi.fn() } }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => mocks.queryReturn,
    useInfiniteQuery: () => ({
        data: undefined,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    queryOptions: (opts: any) => opts,
    infiniteQueryOptions: (opts: any) => opts,
}));

vi.mock("@/api/products.api", () => ({
    productKeys: {
        all: ["products"],
        lists: () => ["products", "list"],
        details: () => ["products", "detail"],
        detail: (id: number) => ["products", "detail", id],
    },
    productsListOptions: (params: any) => ({ queryKey: ["products", "list", params] }),
    productsInfiniteOptions: (params: any) => ({ queryKey: ["products", "list", params] }),
    productDetailOptions: (id: number) => ({ queryKey: ["products", "detail", id] }),
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

vi.mock("@/lib/format", () => ({
    formatPrice: (p: number) => String(p),
    formatDate: (d: string | Date) => new Date(d).toISOString().split("T")[0],
    getLocaleCode: () => "ru-RU",
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

import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";

import { Route } from "../_public/products/$productId";

const mockProduct = {
    id: 1,
    name: "Test Product",
    price: 15000,
    remaining: 50,
    category: {
        id: 10,
        name: "Fruits",
        parent: { id: 5, name: "Food" },
    },
};

const ProductDetailPage = (Route as any).component ?? (Route as any).options?.component;

describe("ProductDetailPage", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
        useUIStore.setState({ locale: "ru" });
        mocks.queryReturn = {
            data: mockProduct,
            isLoading: false,
        };
    });

    test("should render loading skeletons when loading", () => {
        mocks.queryReturn = { data: undefined as any, isLoading: true };

        const { getAllByTestId } = render(<ProductDetailPage />);
        const skeletons = getAllByTestId("skeleton");
        expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    test("should render no_data when product not found", () => {
        mocks.queryReturn = { data: undefined as any, isLoading: false };

        const { getByText } = render(<ProductDetailPage />);
        expect(getByText("no_data")).toBeDefined();
    });

    test("should render product name when loaded", () => {
        const { container } = render(<ProductDetailPage />);
        const h1 = container.querySelector("h1");
        expect(h1?.textContent).toBe("Test Product");
    });

    test("should render product price when loaded", () => {
        const { getByText } = render(<ProductDetailPage />);
        expect(getByText(/15000/)).toBeDefined();
    });

    test("should render remaining stock", () => {
        const { getByText } = render(<ProductDetailPage />);
        const remaining = getByText(/remaining/);
        expect(remaining.textContent).toContain("50");
    });

    test("should render quantity selector with initial value of 1", () => {
        const { getByText } = render(<ProductDetailPage />);
        expect(getByText("1")).toBeDefined();
    });

    test("should render minus and plus buttons for quantity", () => {
        const { container } = render(<ProductDetailPage />);
        const buttons = container.querySelectorAll("button");
        expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    test("should render add to cart button", () => {
        const { getByText } = render(<ProductDetailPage />);
        expect(getByText("add_to_cart")).toBeDefined();
    });

    test("should render page header with breadcrumbs", () => {
        const { getByTestId } = render(<ProductDetailPage />);
        const header = getByTestId("page-header");
        expect(header).toBeDefined();
        expect(header.textContent).toContain("products");
        expect(header.textContent).toContain("Food");
        expect(header.textContent).toContain("Fruits");
        expect(header.textContent).toContain("Test Product");
    });

    test("should render breadcrumbs without parent when category has no parent", () => {
        mocks.queryReturn = {
            data: {
                ...mockProduct,
                category: { id: 10, name: "Fruits", parent: null },
            },
            isLoading: false,
        };

        const { getByText, queryByText } = render(<ProductDetailPage />);
        expect(getByText("Fruits")).toBeDefined();
        expect(queryByText("Food")).toBeNull();
    });

    test("should render sum label next to price", () => {
        const { getByText } = render(<ProductDetailPage />);
        const priceElement = getByText(/15000/);
        expect(priceElement.textContent).toContain("sum");
    });

    test("should render remaining with pieces label", () => {
        const { getByText } = render(<ProductDetailPage />);
        const remaining = getByText(/remaining/);
        expect(remaining.textContent).toContain("pieces");
    });
});
