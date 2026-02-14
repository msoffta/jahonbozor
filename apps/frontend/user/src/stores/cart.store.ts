import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
}

interface CartState {
    items: CartItem[];

    addItem: (item: Omit<CartItem, "quantity">) => void;
    removeItem: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    totalItems: () => number;
    totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (item) =>
                set((state) => {
                    const existing = state.items.find(
                        (i) => i.productId === item.productId,
                    );
                    if (existing) {
                        return {
                            items: state.items.map((i) =>
                                i.productId === item.productId
                                    ? { ...i, quantity: i.quantity + 1 }
                                    : i,
                            ),
                        };
                    }
                    return { items: [...state.items, { ...item, quantity: 1 }] };
                }),

            removeItem: (productId) =>
                set((state) => ({
                    items: state.items.filter((i) => i.productId !== productId),
                })),

            updateQuantity: (productId, quantity) =>
                set((state) => {
                    if (quantity <= 0) {
                        return {
                            items: state.items.filter(
                                (i) => i.productId !== productId,
                            ),
                        };
                    }
                    return {
                        items: state.items.map((i) =>
                            i.productId === productId ? { ...i, quantity } : i,
                        ),
                    };
                }),

            clearCart: () => set({ items: [] }),

            totalItems: () =>
                get().items.reduce((sum, item) => sum + item.quantity, 0),

            totalPrice: () =>
                get().items.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0,
                ),
        }),
        {
            name: "user-cart-store",
        },
    ),
);
