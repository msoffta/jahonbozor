import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { unwrap } from "@/lib/eden-utils";

import type { PublicProductItem } from "@jahonbozor/schemas/src/products";

export const productKeys = {
    all: ["products"] as const,
    lists: () => [...productKeys.all, "list"] as const,
    list: (params: Record<string, unknown>) => [...productKeys.lists(), params] as const,
    details: () => [...productKeys.all, "detail"] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
};

export const productsListOptions = (params: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    categoryIds?: number[];
}) =>
    queryOptions({
        queryKey: productKeys.list(params),
        queryFn: async (): Promise<{ count: number; products: PublicProductItem[] }> => {
            const categoryIds = params.categoryIds?.length
                ? params.categoryIds.join(",")
                : undefined;
            return unwrap(
                await api.api.public.products.get({
                    query: {
                        page: params.page ?? 1,
                        limit: params.limit ?? 20,
                        searchQuery: params.searchQuery ?? "",
                        sortBy: "id",
                        sortOrder: "asc" as const,
                        includeDeleted: false,
                        categoryIds,
                    },
                }),
            );
        },
    });

export const productsInfiniteOptions = (params: {
    limit?: number;
    searchQuery?: string;
    categoryIds?: number[];
}) =>
    infiniteQueryOptions({
        queryKey: productKeys.list({ ...params, infinite: true }),
        queryFn: async ({
            pageParam,
        }): Promise<{ count: number; products: PublicProductItem[] }> => {
            const categoryIds = params.categoryIds?.length
                ? params.categoryIds.join(",")
                : undefined;
            return unwrap(
                await api.api.public.products.get({
                    query: {
                        page: pageParam,
                        limit: params.limit ?? 20,
                        searchQuery: params.searchQuery ?? "",
                        sortBy: "id",
                        sortOrder: "asc" as const,
                        includeDeleted: false,
                        categoryIds,
                    },
                }),
            );
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params.limit ?? 20);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
        },
    });

export const productDetailOptions = (id: number) =>
    queryOptions({
        queryKey: productKeys.detail(id),
        queryFn: async (): Promise<PublicProductItem> =>
            unwrap(await api.api.public.products({ id }).get()),
    });
