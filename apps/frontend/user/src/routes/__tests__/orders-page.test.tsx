import { describe, test, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    ordersData: undefined as {
        count: number;
        orders: Array<{
            id: number;
            status: string;
            paymentType: string;
            createdAt: string;
            items: Array<{ id: number; quantity: number; price: number; product: { name: string } }>;
        }>;
    } | undefined,
    isLoading: false,
}));

vi.mock("@/lib/api-client", () => ({
    api: { api: { public: { orders: Object.assign(() => ({ get: vi.fn(), cancel: { patch: vi.fn() } }), { get: vi.fn(), post: vi.fn() }), auth: { me: { get: vi.fn() }, logout: { post: vi.fn() } }, users: { telegram: { post: vi.fn() }, language: { put: vi.fn() } } } } },
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
        useSearch: () => ({ tab: "active" as const }),
    }),
    lazyRouteComponent: (component: any) => component,
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({
        data: mocks.ordersData,
        isLoading: mocks.isLoading,
    }),
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

vi.mock("@/api/orders.api", () => ({
    orderKeys: { all: ["orders"], lists: () => ["orders", "list"], details: () => ["orders", "detail"], detail: (id: number) => ["orders", "detail", id] },
    ordersListOptions: (params: any) => ({ queryKey: ["orders", params] }),
    orderDetailOptions: (id: number) => ({ queryKey: ["orders", "detail", id] }),
    useCreateOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/orders/order-card", () => ({
    OrderCard: ({ id, status }: any) => (
        <div data-testid={`order-card-${id}`}>Order #{id} - {status}</div>
    ),
}));

import { render } from "@testing-library/react";
import { Route } from "../_user/orders/index";

const OrdersPage = (Route as any).component ?? (Route as any).options?.component;

describe("OrdersPage", () => {
    beforeEach(() => {
        mocks.ordersData = undefined;
        mocks.isLoading = false;
    });

    test("should render active and history tabs", () => {
        const { getByText } = render(<OrdersPage />);
        expect(getByText("active_orders")).toBeDefined();
        expect(getByText("order_history")).toBeDefined();
    });

    test("should show orders when loaded", () => {
        mocks.ordersData = {
            count: 2,
            orders: [
                {
                    id: 1,
                    status: "NEW",
                    paymentType: "CASH",
                    createdAt: "2025-01-15T10:30:00.000Z",
                    items: [{ id: 1, quantity: 2, price: 5000, product: { name: "Item A" } }],
                },
                {
                    id: 2,
                    status: "NEW",
                    paymentType: "CREDIT_CARD",
                    createdAt: "2025-01-16T12:00:00.000Z",
                    items: [{ id: 2, quantity: 1, price: 3000, product: { name: "Item B" } }],
                },
            ],
        };

        const { getByTestId } = render(<OrdersPage />);
        expect(getByTestId("order-card-1")).toBeDefined();
        expect(getByTestId("order-card-2")).toBeDefined();
    });

    test("should show empty state when no orders", () => {
        mocks.ordersData = { count: 0, orders: [] };

        const { getByText } = render(<OrdersPage />);
        expect(getByText("no_data")).toBeDefined();
    });

    test("should show loading skeletons", () => {
        mocks.isLoading = true;

        const { getAllByTestId } = render(<OrdersPage />);
        expect(getAllByTestId("skeleton").length).toBeGreaterThan(0);
    });

    test("should render inside PageTransition", () => {
        const { getByTestId } = render(<OrdersPage />);
        expect(getByTestId("page-transition")).toBeDefined();
    });
});
