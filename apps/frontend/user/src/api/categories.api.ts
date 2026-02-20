import { queryOptions } from "@tanstack/react-query";
import type { PublicCategoryItem } from "@jahonbozor/schemas/src/categories";
import { api } from "@/lib/api-client";

export const categoryKeys = {
    all: ["categories"] as const,
    list: () => [...categoryKeys.all, "list"] as const,
    detail: (id: number) => [...categoryKeys.all, "detail", id] as const,
};

export const categoriesListOptions = () =>
    queryOptions({
        queryKey: categoryKeys.list(),
        queryFn: async (): Promise<{ categories: PublicCategoryItem[] }> => {
            const { data, error } = await api.api.public.categories.get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data;
        },
        staleTime: 1000 * 60 * 30,
    });
