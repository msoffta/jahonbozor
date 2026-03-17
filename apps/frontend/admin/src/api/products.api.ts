import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import { api } from "@/api/client";
import { toast } from "@jahonbozor/ui";

export const productKeys = {
    all: ["products"] as const,
    lists: () => [...productKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...productKeys.lists(), params] as const,
    details: () => [...productKeys.all, "detail"] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
};

export const productsListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    categoryIds?: string;
    minPrice?: number;
    maxPrice?: number;
    includeDeleted?: boolean;
}) =>
    queryOptions({
        queryKey: productKeys.list(params),
        queryFn: async (): Promise<{ count: number; products: AdminProductItem[] }> => {
            const { data, error } = await api.api.private.products.get({
                query: { page: 1, limit: 100, searchQuery: "", includeDeleted: false, ...params },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; products: AdminProductItem[] };
        },
    });

export const productDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: productKeys.detail(id),
        queryFn: async (): Promise<AdminProductItem> => {
            const { data, error } = await api.api.private.products({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as AdminProductItem;
        },
        enabled: id > 0,
    });

// --- Mutation functions (exported for testing) ---

export const createProductFn = async (body: { name: string; price: number; costprice: number; categoryId: number; remaining?: number }) => {
    const { data, error } = await api.api.private.products.post({ ...body, remaining: body.remaining ?? 0 });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminProductItem;
};

export const updateProductFn = async ({ id, ...body }: { id: number; name?: string; price?: number; costprice?: number; categoryId?: number; remaining?: number }) => {
    const { data, error } = await api.api.private.products({ id }).patch(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminProductItem;
};

export const deleteProductFn = async (id: number) => {
    const { data, error } = await api.api.private.products({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminProductItem;
};

export const restoreProductFn = async (id: number) => {
    const { data, error } = await api.api.private.products({ id }).restore.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminProductItem;
};

// --- Hooks ---

export const useCreateProduct = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createProductFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useUpdateProduct = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateProductFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useDeleteProduct = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteProductFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useRestoreProduct = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreProductFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};
