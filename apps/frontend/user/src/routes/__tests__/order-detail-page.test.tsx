import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockDeleteMutate, mocks } = vi.hoisted(() => ({
    mockDeleteMutate: vi.fn(),
    mocks: {
        queryReturn: {} as any,
    },
}));

const mockOrder = {
    id: 42,
    paymentType: "CASH",
    comment: "Deliver quickly",
    createdAt: "2025-01-15T10:30:00.000Z",
    updatedAt: "2025-01-15T11:00:00.000Z",
    items: [
        { id: 1, productId: 10, price: 5000, quantity: 2, product: { name: "Apple" } },
        { id: 2, productId: 20, price: 3000, quantity: 1, product: { name: "Banana" } },
    ],
};

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                orders: Object.assign(() => ({ get: vi.fn(), delete: vi.fn() }), {
                    get: vi.fn(),
                    post: vi.fn(),
                }),
                auth: { me: { get: vi.fn() }, logout: { post: vi.fn() } },
                users: { telegram: { post: vi.fn() }, language: { put: vi.fn() } },
            },
        },
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
        useParams: () => ({ orderId: "42" }),
    }),
    lazyRouteComponent: (component: any) => component,
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => vi.fn(),
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
    useMutation: () => ({ mutate: mockDeleteMutate, isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    queryOptions: (opts: any) => opts,
    infiniteQueryOptions: (opts: any) => opts,
}));

vi.mock("@/api/orders.api", () => ({
    orderKeys: {
        all: ["orders"],
        lists: () => ["orders", "list"],
        details: () => ["orders", "detail"],
        detail: (id: number) => ["orders", "detail", id],
    },
    ordersListOptions: (params: any) => ({ queryKey: ["orders", "list", params] }),
    orderDetailOptions: (id: number) => ({ queryKey: ["orders", "detail", id] }),
    useCreateOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteOrder: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

vi.mock("@/components/catalog/product-card", () => ({
    ProductCard: ({ name, price, quantity, variant }: any) => (
        <div data-testid="product-card">
            <span>{name}</span>
            {price != null && <span data-testid="card-price">{price}</span>}
            {quantity != null && <span data-testid="card-quantity">{quantity}</span>}
            {variant && <span data-testid="card-variant">{variant}</span>}
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

vi.mock("@/components/shared/confirm-drawer", () => ({
    ConfirmDrawer: ({ open, onOpenChange, onConfirm, isLoading }: any) =>
        open ? (
            <div data-testid="confirm-drawer">
                <button
                    type="button"
                    onClick={() => {
                        onConfirm();
                        onOpenChange(false);
                    }}
                    disabled={isLoading}
                >
                    confirm
                </button>
                <button type="button" onClick={() => onOpenChange(false)} disabled={isLoading}>
                    dismiss
                </button>
            </div>
        ) : null,
}));

vi.mock("@/components/orders/order-status-badge", () => ({
    getPaymentTypeLabel: (paymentType: string, t: any) => {
        if (paymentType === "CREDIT_CARD") return t("payment_card");
        if (paymentType === "DEBT") return t("payment_debt", { defaultValue: "Долг" });
        return t("payment_cash");
    },
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useUIStore } from "@/stores/ui.store";

import { Route } from "../_user/orders/$orderId";

const OrderDetailPage = (Route as any).component ?? (Route as any).options?.component;

describe("OrderDetailPage", () => {
    beforeEach(() => {
        useUIStore.setState({ locale: "ru" });
        mocks.queryReturn = {
            data: { ...mockOrder },
            isLoading: false,
        };
    });

    test("should render loading state", () => {
        mocks.queryReturn = { data: undefined, isLoading: true };

        const { getAllByTestId } = render(<OrderDetailPage />);
        const skeletons = getAllByTestId("skeleton");
        expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    test("should render no_data when order not found", () => {
        mocks.queryReturn = { data: undefined, isLoading: false };

        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("no_data")).toBeDefined();
    });

    test("should render order number", () => {
        const { getAllByText } = render(<OrderDetailPage />);
        const orderNumberElements = getAllByText(/order_number/);
        expect(orderNumberElements.length).toBeGreaterThanOrEqual(1);
    });

    test("should render order dates", () => {
        const { getByText, getAllByText } = render(<OrderDetailPage />);
        expect(getByText(/creation_date/)).toBeDefined();
        expect(getByText(/update_date/)).toBeDefined();
        const dateElements = getAllByText("2025-01-15");
        expect(dateElements.length).toBe(2);
    });

    test("should render payment method", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("payment_cash")).toBeDefined();
    });

    test("should render credit card payment method", () => {
        mocks.queryReturn = {
            data: { ...mockOrder, paymentType: "CREDIT_CARD" },
            isLoading: false,
        };

        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("payment_card")).toBeDefined();
    });

    test("should render cancel button", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("cancel_order")).toBeDefined();
    });

    test("should render order items", () => {
        const { getAllByTestId } = render(<OrderDetailPage />);
        const cards = getAllByTestId("product-card");
        expect(cards.length).toBe(2);
    });

    test("should render product names in order items", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("Apple")).toBeDefined();
        expect(getByText("Banana")).toBeDefined();
    });

    test("should render total price", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText(/13000/)).toBeDefined();
    });

    test("should render order comment when present", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("Deliver quickly")).toBeDefined();
    });

    test("should not render comment section when comment is null", () => {
        mocks.queryReturn = {
            data: { ...mockOrder, comment: null },
            isLoading: false,
        };

        const { queryByText } = render(<OrderDetailPage />);
        expect(queryByText("Deliver quickly")).toBeNull();
    });

    test("should render order_items label", () => {
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText(/order_items/)).toBeDefined();
    });

    test("should render page header with breadcrumbs", () => {
        const { getByTestId } = render(<OrderDetailPage />);
        expect(getByTestId("page-header")).toBeDefined();
    });

    test("should open confirm drawer and call delete on confirm", async () => {
        const user = userEvent.setup();
        render(<OrderDetailPage />);

        // Click the cancel order button — should open the drawer
        await user.click(screen.getByText("cancel_order"));
        expect(screen.getByTestId("confirm-drawer")).toBeDefined();

        // Click confirm in the drawer — should call deleteOrder.mutate
        await user.click(screen.getByText("confirm"));
        expect(mockDeleteMutate).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
    });

    test("should not show confirm drawer initially", () => {
        render(<OrderDetailPage />);
        expect(screen.queryByTestId("confirm-drawer")).toBeNull();
    });
});
