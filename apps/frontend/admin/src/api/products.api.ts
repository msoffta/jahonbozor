import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { AdminProductItem, ImportProductRow } from "@jahonbozor/schemas/src/products";

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
                query: {
                    page: 1,
                    limit: 100,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    includeDeleted: false,
                    ...params,
                },
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

export const createProductFn = async (body: {
    name: string;
    price: number;
    costprice: number;
    categoryId?: number;
    remaining?: number;
}) => {
    const { data, error } = await api.api.private.products.post({
        ...body,
        remaining: body.remaining ?? 0,
    });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminProductItem;
};

export const updateProductFn = async ({
    id,
    ...body
}: {
    id: number;
    name?: string;
    price?: number;
    costprice?: number;
    categoryId?: number;
    remaining?: number;
}) => {
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
            toast.error(i18n.t("error"));
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
            toast.error(i18n.t("error"));
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
            toast.error(i18n.t("error"));
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
            toast.error(i18n.t("error"));
        },
    });
};

// --- Import ---

export const importProductsFn = async (products: ImportProductRow[]) => {
    const { data, error } = await api.api.private.products.import.post({
        products,
    });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as { created: number; updated: number; total: number };
};

export const useImportProducts = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: importProductsFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
