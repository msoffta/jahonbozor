import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { unwrap } from "@/lib/eden-utils";

import type { PublicCategoryItem } from "@jahonbozor/schemas/src/categories";

export const categoryKeys = {
    all: ["categories"] as const,
    list: () => [...categoryKeys.all, "list"] as const,
    detail: (id: number) => [...categoryKeys.all, "detail", id] as const,
};

export const categoriesListOptions = () =>
    queryOptions({
        queryKey: categoryKeys.list(),
        queryFn: async (): Promise<{ categories: PublicCategoryItem[] }> =>
            unwrap(await api.api.public.categories.get()),
        staleTime: 1000 * 60 * 30,
    });
