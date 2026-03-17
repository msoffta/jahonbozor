import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

import { ProductCard } from "../product-card";

describe("ProductCard", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
    });

    test("should render product name", () => {
        const { getByText } = render(<ProductCard productId={1} name="Test Product" price={50000} remaining={10} />);
        expect(getByText("Test Product")).toBeDefined();
    });

    test("should render formatted price", () => {
        const { getByText } = render(<ProductCard productId={1} name="Test" price={50000} remaining={10} />);
        expect(getByText(/50\s*000/)).toBeDefined();
    });

    test("should render remaining count", () => {
        const { getByText } = render(<ProductCard productId={1} name="Test" price={100} remaining={42} />);
        expect(getByText(/42/)).toBeDefined();
    });

    test("should add item to cart on button click", () => {
        const { getByRole } = render(<ProductCard productId={5} name="Product A" price={1000} remaining={10} />);

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

    test("should show quantity control after adding to cart", () => {
        useCartStore.setState({
            items: [{ productId: 5, name: "Product A", price: 1000, quantity: 1 }],
        });

        const { getByText, getAllByRole } = render(
            <ProductCard productId={5} name="Product A" price={1000} remaining={10} />,
        );

        expect(getByText("1")).toBeDefined();
        const buttons = getAllByRole("button");
        expect(buttons.length).toBe(2); // minus and plus
    });

    test("should increment quantity via quantity control", () => {
        useCartStore.setState({
            items: [{ productId: 5, name: "Product A", price: 1000, quantity: 1 }],
        });

        const { getAllByRole } = render(
            <ProductCard productId={5} name="Product A" price={1000} remaining={10} />,
        );

        const buttons = getAllByRole("button");
        const plusButton = buttons[buttons.length - 1]; // last button is +
        fireEvent.click(plusButton);

        expect(useCartStore.getState().items[0].quantity).toBe(2);
    });
});
