import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useCartStore } from "@/stores/cart.store";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

vi.mock("@/components/catalog/quantity-control", () => ({
    QuantityControl: ({ quantity, onIncrement, onDecrement }: any) => (
        <div data-testid="quantity-control">
            <button data-testid="decrement" onClick={onDecrement}>
                -
            </button>
            <span data-testid="quantity">{quantity}</span>
            <button data-testid="increment" onClick={onIncrement}>
                +
            </button>
        </div>
    ),
}));

import { ProductCard } from "@/components/catalog/product-card";

describe("ProductCard variant='cart'", () => {
    const defaultProps = {
        variant: "cart" as const,
        productId: 1,
        name: "Test Item",
        price: 5000,
        quantity: 3,
        selected: false,
        onSelect: vi.fn(),
    };

    beforeEach(() => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Test Item", price: 5000, quantity: 3 }],
        });
        defaultProps.onSelect = vi.fn();
    });

    test("should render item name", () => {
        const { getByText } = render(<ProductCard {...defaultProps} />);
        expect(getByText("Test Item")).toBeDefined();
    });

    test("should render price", () => {
        const { getByText } = render(<ProductCard {...defaultProps} />);
        expect(getByText(/5\s*000/)).toBeDefined();
    });

    test("should render quantity via QuantityControl", () => {
        const { getByTestId } = render(<ProductCard {...defaultProps} />);
        expect(getByTestId("quantity").textContent).toBe("3");
    });

    test("should call updateQuantity with +1 on increment", () => {
        const { getByTestId } = render(<ProductCard {...defaultProps} />);
        fireEvent.click(getByTestId("increment"));

        const item = useCartStore.getState().items.find((i) => i.productId === 1);
        expect(item?.quantity).toBe(4);
    });

    test("should call updateQuantity with -1 on decrement", () => {
        const { getByTestId } = render(<ProductCard {...defaultProps} />);
        fireEvent.click(getByTestId("decrement"));

        const item = useCartStore.getState().items.find((i) => i.productId === 1);
        expect(item?.quantity).toBe(2);
    });

    test("should call onSelect when checkbox changes", () => {
        const { getByTestId } = render(<ProductCard {...defaultProps} />);

        const checkbox = getByTestId("checkbox");
        fireEvent.click(checkbox);

        expect(defaultProps.onSelect).toHaveBeenCalled();
    });
});
