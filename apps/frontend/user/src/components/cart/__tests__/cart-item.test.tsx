import { describe, test, expect, mock, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { useCartStore } from "@/stores/cart.store";

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@jahonbozor/ui", () => ({
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            data-testid="checkbox"
            {...props}
        />
    ),
}));

mock.module("@/components/catalog/quantity-control", () => ({
    QuantityControl: ({ quantity, onIncrement, onDecrement }: any) => (
        <div data-testid="quantity-control">
            <button data-testid="decrement" onClick={onDecrement}>-</button>
            <span data-testid="quantity">{quantity}</span>
            <button data-testid="increment" onClick={onIncrement}>+</button>
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
        onSelect: mock(() => {}),
    };

    beforeEach(() => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Test Item", price: 5000, quantity: 3 }],
        });
        defaultProps.onSelect = mock(() => {});
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
