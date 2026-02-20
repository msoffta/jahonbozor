import { describe, test, expect, beforeEach } from "bun:test";
import { useCartStore } from "../cart.store";

describe("Cart Store", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
    });

    describe("addItem", () => {
        test("should add new item with quantity 1", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0]).toEqual({ productId: 1, name: "Test", price: 100, quantity: 1 });
        });

        test("should increment quantity if item already exists", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].quantity).toBe(2);
        });

        test("should add different items separately", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test A", price: 100 });
            useCartStore.getState().addItem({ productId: 2, name: "Test B", price: 200 });

            expect(useCartStore.getState().items).toHaveLength(2);
        });
    });

    describe("removeItem", () => {
        test("should remove item by productId", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().removeItem(1);

            expect(useCartStore.getState().items).toHaveLength(0);
        });

        test("should not affect other items", () => {
            useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
            useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 });
            useCartStore.getState().removeItem(1);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].productId).toBe(2);
        });

        test("should handle removing non-existent item", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().removeItem(999);

            expect(useCartStore.getState().items).toHaveLength(1);
        });
    });

    describe("updateQuantity", () => {
        test("should update quantity for existing item", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().updateQuantity(1, 5);

            expect(useCartStore.getState().items[0].quantity).toBe(5);
        });

        test("should remove item when quantity is 0", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().updateQuantity(1, 0);

            expect(useCartStore.getState().items).toHaveLength(0);
        });

        test("should remove item when quantity is negative", () => {
            useCartStore.getState().addItem({ productId: 1, name: "Test", price: 100 });
            useCartStore.getState().updateQuantity(1, -1);

            expect(useCartStore.getState().items).toHaveLength(0);
        });
    });

    describe("clearCart", () => {
        test("should remove all items", () => {
            useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
            useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 });
            useCartStore.getState().clearCart();

            expect(useCartStore.getState().items).toHaveLength(0);
        });

        test("should handle clearing empty cart", () => {
            useCartStore.getState().clearCart();
            expect(useCartStore.getState().items).toHaveLength(0);
        });
    });

    describe("totalItems", () => {
        test("should return sum of all quantities", () => {
            useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
            useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
            useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 });

            expect(useCartStore.getState().totalItems()).toBe(3);
        });

        test("should return 0 for empty cart", () => {
            expect(useCartStore.getState().totalItems()).toBe(0);
        });
    });

    describe("totalPrice", () => {
        test("should return sum of price * quantity for all items", () => {
            useCartStore.getState().addItem({ productId: 1, name: "A", price: 100 });
            useCartStore.getState().updateQuantity(1, 3);
            useCartStore.getState().addItem({ productId: 2, name: "B", price: 200 });

            expect(useCartStore.getState().totalPrice()).toBe(500);
        });

        test("should return 0 for empty cart", () => {
            expect(useCartStore.getState().totalPrice()).toBe(0);
        });
    });
});
