import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("motion/react", async () => {
    const { motionMocks } = await import("../../../../test-utils/ui-mocks");
    return motionMocks;
});

vi.mock("@jahonbozor/ui", async () => {
    const { uiMocks, motionMocks } = await import("../../../../test-utils/ui-mocks");
    return {
        ...uiMocks,
        ...motionMocks,
        useIsMobile: () => false,
        toast: { error: vi.fn() },
        PageTransition: ({ children, className }: any) => (
            <div className={className}>{children}</div>
        ),
    };
});

const mockMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/api/orders.api", () => ({
    orderDetailQueryOptions: () => ({}),
    useDeleteOrder: () => ({ mutate: mockDeleteMutate, isPending: false }),
    useUpdateOrder: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock("@/api/products.api", () => ({
    productsListQueryOptions: () => ({}),
    searchProductsFn: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/orders/order-items-columns", () => ({
    getOrderItemColumns: () => [],
}));

vi.mock("@/components/shared/confirm-drawer", () => ({
    ConfirmDrawer: () => null,
}));

vi.mock("@/hooks/use-data-table-translations", () => ({
    useDataTableTranslations: () => ({}),
}));

vi.mock("@/lib/format", () => ({
    formatCurrency: (val: number, suffix: string) => `${val} ${suffix}`,
}));

vi.mock("date-fns", () => ({
    format: () => "01.01.2026 12:00",
}));

// Mock permission hooks with configurable return values
let permissionMocks: Record<string, boolean> = {};

vi.mock("@/hooks/use-permissions", () => ({
    useHasPermission: (permission: string) => permissionMocks[permission] || false,
}));

interface MockOrderItem {
    id: number;
    productId: number | null;
    quantity: number;
    price: number;
    product: {
        id: number;
        name: string;
        price: number;
        remaining: number;
        costprice: number;
    } | null;
}

interface MockOrder {
    id: number;
    userId: null;
    staffId: number;
    paymentType: string;
    comment: string | null;
    data: null;
    createdAt: string;
    updatedAt: string;
    items: MockOrderItem[];
    user: null;
    staff: { id: number; fullname: string };
}

const mockOrder: MockOrder = {
    id: 1,
    userId: null,
    staffId: 1,
    paymentType: "CASH",
    comment: "Test comment",
    data: null,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
    items: [
        {
            id: 1,
            productId: 1,
            quantity: 2,
            price: 100,
            product: { id: 1, name: "Product 1", price: 100, remaining: 10, costprice: 50 },
        },
    ],
    user: null,
    staff: { id: 1, fullname: "Staff 1" },
};

let queryData: MockOrder | null = mockOrder;
let isLoading = false;

vi.mock("@tanstack/react-query", () => ({
    useQuery: ({ queryKey }: any = {}) => {
        if (queryKey?.[1] === "detail" || !queryKey) {
            return { data: isLoading ? undefined : queryData, isLoading };
        }
        return { data: { products: [] }, isLoading: false };
    },
}));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (config: any) => ({
        ...config,
        useParams: () => ({ orderId: "1" }),
    }),
    redirect: vi.fn(),
    useNavigate: () => vi.fn(),
}));

vi.mock("@/stores/auth.store", () => ({
    useAuthStore: Object.assign(() => ({}), {
        getState: () => ({ permissions: [] }),
    }),
}));

// Dynamically import the component AFTER mocks
const { Route } = await import("../$orderId");
const OrderDetailPage = (Route as any).component;

describe("OrderDetailPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        permissionMocks = {};
        queryData = mockOrder;
        isLoading = false;
    });

    test("should show loading skeleton when loading", () => {
        isLoading = true;
        const { getByTestId } = render(<OrderDetailPage />);
        expect(getByTestId("data-table-skeleton")).toBeDefined();
    });

    test("should show empty state when order is null", () => {
        queryData = null;
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("orders_empty")).toBeDefined();
    });

    test("should render order details", () => {
        permissionMocks = {};
        const { getByText } = render(<OrderDetailPage />);
        expect(getByText("lists_title #1")).toBeDefined();
        expect(getByText("payment_cash")).toBeDefined();
    });

    test("should show comment as read-only text when no update permission", () => {
        permissionMocks = {};
        const { getByText, queryByPlaceholderText } = render(<OrderDetailPage />);
        expect(getByText("Test comment")).toBeDefined();
        expect(queryByPlaceholderText("order_comment")).toBeNull();
    });

    test("should show comment input when user has update permission", () => {
        permissionMocks = { "orders:update:own": true };
        const { getByDisplayValue } = render(<OrderDetailPage />);
        expect(getByDisplayValue("Test comment")).toBeDefined();
    });

    test("should call updateOrder on blur when comment changes", () => {
        permissionMocks = { "orders:update:own": true };
        const { getByDisplayValue } = render(<OrderDetailPage />);
        const input = getByDisplayValue("Test comment");

        fireEvent.change(input, { target: { value: "New comment" } });
        fireEvent.blur(input);

        expect(mockMutate).toHaveBeenCalledWith({
            id: 1,
            comment: "New comment",
        });
    });

    test("should not call updateOrder on blur when comment is unchanged", () => {
        permissionMocks = { "orders:update:own": true };
        const { getByDisplayValue } = render(<OrderDetailPage />);
        const input = getByDisplayValue("Test comment");

        fireEvent.blur(input);

        expect(mockMutate).not.toHaveBeenCalled();
    });

    test("should send null comment when input is cleared", () => {
        permissionMocks = { "orders:update:own": true };
        const { getByDisplayValue } = render(<OrderDetailPage />);
        const input = getByDisplayValue("Test comment");

        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);

        expect(mockMutate).toHaveBeenCalledWith({
            id: 1,
            comment: null,
        });
    });

    test("should trim whitespace from comment before saving", () => {
        permissionMocks = { "orders:update:own": true };
        const { getByDisplayValue } = render(<OrderDetailPage />);
        const input = getByDisplayValue("Test comment");

        fireEvent.change(input, { target: { value: "  Trimmed  " } });
        fireEvent.blur(input);

        expect(mockMutate).toHaveBeenCalledWith({
            id: 1,
            comment: "Trimmed",
        });
    });

    test("should not show comment text when order has no comment and no update permission", () => {
        queryData = { ...mockOrder, comment: null };
        permissionMocks = {};
        const { queryByText } = render(<OrderDetailPage />);
        expect(queryByText("Test comment")).toBeNull();
    });

    test("should show empty input placeholder when order has no comment but user has update permission", () => {
        queryData = { ...mockOrder, comment: null };
        permissionMocks = { "orders:update:own": true };
        const { getByPlaceholderText } = render(<OrderDetailPage />);
        expect(getByPlaceholderText("order_comment")).toBeDefined();
    });

    test("should show delete button when user has delete permission", () => {
        permissionMocks = { "orders:delete": true };
        const { container } = render(<OrderDetailPage />);
        const deleteButton = container.querySelector("button[class*='destructive']");
        expect(deleteButton).toBeDefined();
    });

    test("should hide delete button when user lacks delete permission", () => {
        permissionMocks = {};
        const { container } = render(<OrderDetailPage />);
        const buttons = container.querySelectorAll("button");
        const destructiveButton = Array.from(buttons).find((b) =>
            b.getAttribute("class")?.includes("destructive"),
        );
        expect(destructiveButton).toBeUndefined();
    });

    describe("null-product items", () => {
        const mockOrderWithNullProduct = {
            ...mockOrder,
            items: [
                {
                    id: 1,
                    productId: null,
                    quantity: 3,
                    price: 150,
                    product: null,
                },
            ],
        };

        const mockOrderWithMixedItems = {
            ...mockOrder,
            items: [
                {
                    id: 1,
                    productId: 1,
                    quantity: 2,
                    price: 100,
                    product: { id: 1, name: "Product 1", price: 100, remaining: 10, costprice: 50 },
                },
                {
                    id: 2,
                    productId: null,
                    quantity: 5,
                    price: 200,
                    product: null,
                },
            ],
        };

        test("should render order with null-product item", () => {
            queryData = mockOrderWithNullProduct;
            const { getByText } = render(<OrderDetailPage />);
            expect(getByText("lists_title #1")).toBeDefined();
        });

        test("should calculate total sum including null-product items", () => {
            queryData = mockOrderWithNullProduct;
            const { container } = render(<OrderDetailPage />);
            // 150 * 3 = 450
            expect(container.textContent).toContain("450");
        });

        test("should calculate total sum for mixed items correctly", () => {
            queryData = mockOrderWithMixedItems;
            const { container } = render(<OrderDetailPage />);
            // (100 * 2) + (200 * 5) = 200 + 1000 = 1200
            expect(container.textContent).toContain("1200");
        });

        test("should render receipt for order with null-product items", () => {
            queryData = mockOrderWithNullProduct;
            render(<OrderDetailPage />);
            const receiptContainer = document.body.querySelector(".print-receipt-container");
            expect(receiptContainer).toBeDefined();
        });
    });
});
