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

interface ProductsInfiniteCache {
    pages: { count: number; products: AdminProductItem[] }[];
    pageParams: number[];
}

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
                    limit: params?.limit ?? 10000,
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
            const loaded = lastPageParam * (params?.limit ?? 10000);
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

/** Server-side product search for combobox (returns full product objects for caching) */
export const searchProductsDetailFn = async (query: string): Promise<AdminProductItem[]> => {
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
    return result.products;
};

/** Server-side product search for combobox (returns {label, value} pairs) */
export const searchProductsFn = async (
    query: string,
): Promise<{ label: string; value: string }[]> => {
    const products = await searchProductsDetailFn(query);
    return products.map((p) => ({ label: p.name, value: String(p.id) }));
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
        onSuccess: (newProduct) => {
            queryClient.setQueriesData<ProductsInfiniteCache>(
                { queryKey: productKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    const lastIdx = old.pages.length - 1;
                    return {
                        ...old,
                        pages: old.pages.map((page, index) =>
                            index === lastIdx
                                ? {
                                      count: page.count + 1,
                                      products: [...page.products, newProduct],
                                  }
                                : page,
                        ),
                    };
                },
            );
            queryClient.setQueryData(productKeys.detail(newProduct.id), newProduct);
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
        onSuccess: (updatedProduct) => {
            queryClient.setQueriesData<ProductsInfiniteCache>(
                { queryKey: productKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            products: page.products.map((p) =>
                                p.id === updatedProduct.id ? updatedProduct : p,
                            ),
                        })),
                    };
                },
            );
            queryClient.setQueryData(productKeys.detail(updatedProduct.id), updatedProduct);
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
        onSuccess: (deletedProduct) => {
            const deletedId = deletedProduct?.id;
            if (deletedId == null) return;
            queryClient.setQueriesData<ProductsInfiniteCache>(
                { queryKey: productKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => {
                            const filtered = page.products.filter((p) => p.id !== deletedId);
                            return {
                                count: Math.max(
                                    0,
                                    page.count - (page.products.length - filtered.length),
                                ),
                                products: filtered,
                            };
                        }),
                    };
                },
            );
            queryClient.removeQueries({ queryKey: productKeys.detail(deletedId) });
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
        onSuccess: (restoredProduct) => {
            queryClient.setQueriesData<ProductsInfiniteCache>(
                { queryKey: productKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            products: page.products.map((p) =>
                                p.id === restoredProduct.id
                                    ? { ...p, ...restoredProduct, deletedAt: null }
                                    : p,
                            ),
                        })),
                    };
                },
            );
            queryClient.setQueryData(productKeys.detail(restoredProduct.id), restoredProduct);
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
            // Bulk import can create/update many products at once — no single
            // record to patch into the cache. Keep invalidateQueries here so the
            // list refetches and shows all imported rows.
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
