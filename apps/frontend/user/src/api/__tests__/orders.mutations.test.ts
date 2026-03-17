import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useCartStore } from "@/stores/cart.store";

const mockOrder = {
    id: 1,
    paymentType: "CASH",
    status: "NEW",
    comment: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    items: [{ productId: 1, name: "Test", price: 100, quantity: 2 }],
};

const mockCancelledOrder = { ...mockOrder, status: "CANCELLED" };

type EdenFn = (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>;

const { mockOrderPost, mockCancelPatch, mockInvalidateQueries, mockToastError } = vi.hoisted(
    () => ({
        mockOrderPost: vi.fn<EdenFn>(() =>
            Promise.resolve({
                data: { success: true, data: mockOrder },
                error: null,
            }),
        ),
        mockCancelPatch: vi.fn<EdenFn>(() =>
            Promise.resolve({
                data: { success: true, data: mockCancelledOrder },
                error: null,
            }),
        ),
        mockInvalidateQueries: vi.fn(() => Promise.resolve()),
        mockToastError: vi.fn(),
    }),
);

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                orders: Object.assign(
                    (_params: { id: number }) => ({
                        get: vi.fn(() =>
                            Promise.resolve({
                                data: { success: true, data: mockOrder },
                                error: null,
                            }),
                        ),
                        cancel: { patch: mockCancelPatch },
                    }),
                    {
                        get: vi.fn(() =>
                            Promise.resolve({
                                data: {
                                    success: true,
                                    data: { count: 0, orders: [] },
                                },
                                error: null,
                            }),
                        ),
                        post: mockOrderPost,
                    },
                ),
            },
        },
    },
}));

vi.mock("@jahonbozor/ui", () => ({
    toast: { error: mockToastError },
}));

vi.mock("@/lib/i18n", () => ({
    i18n: { t: (key: string) => key },
}));

vi.mock("@tanstack/react-query", () => ({
    useMutation: ({ mutationFn, onSuccess, onError, onSettled }: any) => ({
        mutate: async (...args: any[]) => {
            try {
                const result = await mutationFn(...args);
                if (onSuccess) await onSuccess(result, ...args);
                return result;
            } catch (e) {
                if (onError) onError(e);
                throw e;
            } finally {
                if (onSettled) onSettled();
            }
        },
        mutateAsync: mutationFn,
        isPending: false,
        isError: false,
    }),
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
    queryOptions: (opts: any) => opts,
}));

import { useCancelOrder, useCreateOrder } from "../orders.api";

describe("useCreateOrder", () => {
    const orderBody = {
        paymentType: "CASH" as const,
        comment: null,
        items: [{ productId: 1, quantity: 2, price: 100 }],
    };

    beforeEach(() => {
        useCartStore.setState({
            items: [{ productId: 1, name: "Test", price: 100, quantity: 2 }],
        });
    });

    test("should call API with order body", async () => {
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(orderBody);

        expect(mockOrderPost).toHaveBeenCalledWith(orderBody);
    });

    test("should return order data on success", async () => {
        const { result } = renderHook(() => useCreateOrder());
        const data = await result.current.mutateAsync(orderBody);

        expect(data).toEqual(mockOrder);
    });

    test("should invalidate order list queries on success", async () => {
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(orderBody);

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ["orders", "list"],
        });
    });

    test("should clear cart on success", async () => {
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(orderBody);

        expect(useCartStore.getState().items).toEqual([]);
    });

    test("should throw on API error", async () => {
        mockOrderPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Network error"),
        });

        const { result } = renderHook(() => useCreateOrder());
        await expect(result.current.mutate(orderBody)).rejects.toThrow("Network error");
    });

    test("should throw on unsuccessful response", async () => {
        mockOrderPost.mockResolvedValueOnce({
            data: { success: false },
            error: null,
        });

        const { result } = renderHook(() => useCreateOrder());
        await expect(result.current.mutate(orderBody)).rejects.toThrow("Request failed");
    });

    test("should show error toast on API error", async () => {
        mockOrderPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Server error"),
        });

        const { result } = renderHook(() => useCreateOrder());
        try {
            await result.current.mutate(orderBody);
        } catch {
            // expected
        }

        expect(mockToastError).toHaveBeenCalledWith("error");
    });

    test("should not clear cart on API error", async () => {
        mockOrderPost.mockResolvedValueOnce({
            data: null,
            error: new Error("Server error"),
        });

        const { result } = renderHook(() => useCreateOrder());
        try {
            await result.current.mutate(orderBody);
        } catch {
            // expected
        }

        expect(useCartStore.getState().items).toHaveLength(1);
    });

    test("should support CREDIT_CARD payment type", async () => {
        const cardOrder = {
            ...orderBody,
            paymentType: "CREDIT_CARD" as const,
        };
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(cardOrder);

        expect(mockOrderPost).toHaveBeenCalledWith(cardOrder);
    });

    test("should support DEBT payment type", async () => {
        const debtOrder = { ...orderBody, paymentType: "DEBT" as const };
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(debtOrder);

        expect(mockOrderPost).toHaveBeenCalledWith(debtOrder);
    });

    test("should support optional comment", async () => {
        const withComment = { ...orderBody, comment: "Deliver fast please" };
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(withComment);

        expect(mockOrderPost).toHaveBeenCalledWith(withComment);
    });

    test("should handle multiple items", async () => {
        const multiItemOrder = {
            ...orderBody,
            items: [
                { productId: 1, quantity: 2, price: 100 },
                { productId: 2, quantity: 1, price: 500 },
                { productId: 3, quantity: 5, price: 50 },
            ],
        };
        const { result } = renderHook(() => useCreateOrder());
        await result.current.mutate(multiItemOrder);

        expect(mockOrderPost).toHaveBeenCalledWith(multiItemOrder);
    });
});

describe("useCancelOrder", () => {
    test("should call cancel API", async () => {
        const { result } = renderHook(() => useCancelOrder());
        await result.current.mutate(5);

        expect(mockCancelPatch).toHaveBeenCalled();
    });

    test("should return cancelled order data", async () => {
        const { result } = renderHook(() => useCancelOrder());
        const data = await result.current.mutateAsync(1);

        expect(data).toEqual(mockCancelledOrder);
    });

    test("should invalidate list queries on success", async () => {
        const { result } = renderHook(() => useCancelOrder());
        await result.current.mutate(5);

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ["orders", "list"],
        });
    });

    test("should invalidate detail query for specific order on success", async () => {
        const { result } = renderHook(() => useCancelOrder());
        await result.current.mutate(42);

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ["orders", "detail", 42],
        });
    });

    test("should invalidate both list and detail queries", async () => {
        const { result } = renderHook(() => useCancelOrder());
        await result.current.mutate(10);

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });

    test("should throw on API error", async () => {
        mockCancelPatch.mockResolvedValueOnce({
            data: null,
            error: new Error("Forbidden"),
        });

        const { result } = renderHook(() => useCancelOrder());
        await expect(result.current.mutate(1)).rejects.toThrow("Forbidden");
    });

    test("should throw on unsuccessful response", async () => {
        mockCancelPatch.mockResolvedValueOnce({
            data: { success: false },
            error: null,
        });

        const { result } = renderHook(() => useCancelOrder());
        await expect(result.current.mutate(1)).rejects.toThrow("Request failed");
    });

    test("should show error toast on cancel error", async () => {
        mockCancelPatch.mockResolvedValueOnce({
            data: null,
            error: new Error("Forbidden"),
        });

        const { result } = renderHook(() => useCancelOrder());
        try {
            await result.current.mutate(1);
        } catch {
            // expected
        }

        expect(mockToastError).toHaveBeenCalledWith("error");
    });

    test("should not invalidate queries on error", async () => {
        mockCancelPatch.mockResolvedValueOnce({
            data: null,
            error: new Error("Server error"),
        });

        const { result } = renderHook(() => useCancelOrder());
        try {
            await result.current.mutate(1);
        } catch {
            // expected
        }

        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
});
