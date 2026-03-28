import {
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

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

export const productsInfiniteQueryOptions = (params?: {
    limit?: number;
    searchQuery?: string;
    categoryIds?: string;
    minPrice?: number;
    maxPrice?: number;
    includeDeleted?: boolean;
}) =>
    infiniteQueryOptions({
        queryKey: productKeys.list({ ...params, infinite: true }),
        queryFn: async ({
            pageParam,
        }): Promise<{ count: number; products: AdminProductItem[] }> => {
            const { data, error } = await api.api.private.products.get({
                query: {
                    page: pageParam,
                    limit: params?.limit ?? 1000,
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
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params?.limit ?? 50);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
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

/** Server-side product search for combobox (returns {label, value} pairs) */
export const searchProductsFn = async (
    query: string,
): Promise<{ label: string; value: string }[]> => {
    const { data, error } = await api.api.private.products.get({
        query: {
            searchQuery: query,
            limit: 20,
            page: 1,
            sortBy: "id",
            sortOrder: "asc" as const,
            includeDeleted: false,
        },
    });
    if (error || !data.success) return [];
    const result = data.data as { count: number; products: AdminProductItem[] };
    return result.products.map((p) => ({ label: p.name, value: String(p.id) }));
};

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
        mutationKey: ["products", "create"],
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
        mutationKey: ["products", "update"],
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
        mutationKey: ["products", "delete"],
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
        mutationKey: ["products", "restore"],
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
        mutationKey: ["products", "import"],
        mutationFn: importProductsFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
