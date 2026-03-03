import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminCategoryItem } from "@jahonbozor/schemas/src/categories";
import { api } from "@/api/client";

export const categoryKeys = {
    all: ["categories"] as const,
    list: (params?: Record<string, unknown>) => [...categoryKeys.all, "list", params] as const,
};

export const categoriesListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
}) =>
    queryOptions({
        queryKey: categoryKeys.list(params),
        queryFn: async (): Promise<{ count: number; categories: AdminCategoryItem[] }> => {
            const { data, error } = await api.api.private.categories.get({
                query: { page: 1, limit: 100, searchQuery: "", depth: 1, ...params },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; categories: AdminCategoryItem[] };
        },
    });

export const createCategoryFn = async (body: { name: string; parentId?: number | null }) => {
    const { data, error } = await api.api.private.categories.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminCategoryItem;
};

export const useCreateCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCategoryFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: categoryKeys.all });
        },
    });
};
