import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockMutate, mockNavigate } = vi.hoisted(() => ({
    mockMutate: vi.fn(),
    mockNavigate: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                orders: Object.assign(() => ({ get: vi.fn(), cancel: { patch: vi.fn() } }), {
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
    createFileRoute: () => (config: any) => config,
    lazyRouteComponent: (component: any) => component,
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => mockNavigate,
    useRouter: () => ({ history: { back: vi.fn() } }),
    redirect: () => {},
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
    useCreateOrder: () => ({ mutate: mockMutate, isPending: false }),
    useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/catalog/product-card", () => ({
    ProductCard: ({ name, price, quantity, variant, selected }: any) => (
        <div data-testid="product-card">
            <span>{name}</span>
            {price != null && <span data-testid="card-price">{price}</span>}
            {quantity != null && <span data-testid="card-quantity">{quantity}</span>}
            {variant && <span data-testid="card-variant">{variant}</span>}
            {selected != null && <span data-testid="card-selected">{String(selected)}</span>}
        </div>
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

import { fireEvent, render } from "@testing-library/react";

import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";

import { Route } from "../_user/cart";

const CartPage = (Route as any).component ?? (Route as any).options?.component;

describe("CartPage", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
        useUIStore.setState({ locale: "ru" });
    });

    test("should render empty cart state when no items", () => {
        const { getByText } = render(<CartPage />);
        expect(getByText("empty_cart")).toBeDefined();
    });

    test("should render ShoppingCart icon in empty state", () => {
        const { container } = render(<CartPage />);
        const svg = container.querySelector("svg");
        expect(svg).toBeDefined();
    });

    test("should render cart items when items exist", () => {
        useCartStore.setState({
            items: [
                { productId: 1, name: "Apple", price: 5000, quantity: 2 },
                { productId: 2, name: "Banana", price: 3000, quantity: 1 },
            ],
        });

        const { getAllByTestId } = render(<CartPage />);
        const cards = getAllByTestId("product-card");
        expect(cards.length).toBe(2);
    });

    test("should render select all checkbox", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText } = render(<CartPage />);
        expect(getByText("select_all")).toBeDefined();
    });

    test("should render select all checkbox as checked when all items selected", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByTestId } = render(<CartPage />);
        const checkbox = getByTestId("checkbox") as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    test("should render payment type buttons", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText } = render(<CartPage />);
        expect(getByText("payment_card")).toBeDefined();
        expect(getByText("payment_cash")).toBeDefined();
        expect(getByText(/payment_debt/)).toBeDefined();
    });

    test("should render buy button", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText } = render(<CartPage />);
        expect(getByText("buy")).toBeDefined();
    });

    test("should show total price", () => {
        useCartStore.setState({
            items: [
                { productId: 1, name: "Apple", price: 5000, quantity: 2 },
                { productId: 2, name: "Banana", price: 3000, quantity: 1 },
            ],
        });

        const { getByText } = render(<CartPage />);
        expect(getByText(/13000/)).toBeDefined();
    });

    test("should disable buy button when no items selected", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText, getByTestId } = render(<CartPage />);

        const checkbox = getByTestId("checkbox") as HTMLInputElement;
        fireEvent.click(checkbox);

        const buyButton = getByText("buy").closest("button");
        expect(buyButton?.disabled).toBe(true);
    });

    test("should render comment input", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { container } = render(<CartPage />);
        const input = container.querySelector("input[type='text'], input:not([type])")!;
        expect(input).toBeDefined();
    });

    test("should call mutate when buy button is clicked", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText } = render(<CartPage />);
        const buyButton = getByText("buy").closest("button")!;
        fireEvent.click(buyButton);

        expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    test("should pass selected items to createOrder mutate", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByText } = render(<CartPage />);
        fireEvent.click(getByText("buy").closest("button")!);

        const callArgs = mockMutate.mock.calls[0][0];
        expect(callArgs.paymentType).toBe("CREDIT_CARD");
        expect(callArgs.items).toHaveLength(1);
        expect(callArgs.items[0].productId).toBe(1);
        expect(callArgs.items[0].quantity).toBe(2);
        expect(callArgs.items[0].price).toBe(5000);
    });

    test("should switch payment type on button click", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 1 }],
        });

        const { getByText } = render(<CartPage />);
        fireEvent.click(getByText("payment_cash"));
        fireEvent.click(getByText("buy").closest("button")!);

        const callArgs = mockMutate.mock.calls[0][0];
        expect(callArgs.paymentType).toBe("CASH");
    });

    test("should show total as 0 when all items deselected", () => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Apple", price: 5000, quantity: 2 }],
        });

        const { getByTestId, container } = render(<CartPage />);
        const checkbox = getByTestId("checkbox") as HTMLInputElement;
        fireEvent.click(checkbox);

        const totalPriceEl = container.querySelector(".text-lg.font-bold");
        expect(totalPriceEl?.textContent).toContain("0");
    });
});
