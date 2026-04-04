import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

export const templateKeys = {
    all: ["templates"] as const,
    lists: () => [...templateKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...templateKeys.lists(), params] as const,
    details: () => [...templateKeys.all, "detail"] as const,
    detail: (id: number) => [...templateKeys.details(), id] as const,
};

export const templatesListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
}) =>
    queryOptions({
        queryKey: templateKeys.list(params),
        queryFn: async () => {
            const { data, error } = await api.api.private["broadcast-templates"].get({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "desc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as {
                count: number;
                templates: Record<string, unknown>[];
            };
        },
    });

export const templateDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: templateKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.api.private["broadcast-templates"]({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as Record<string, unknown>;
        },
        enabled: id > 0,
    });

// --- Mutation functions ---

export const createTemplateFn = async (body: {
    name: string;
    content: string;
    media?: { type: "photo" | "video" | "document"; url: string }[] | null;
    buttons?: { text: string; url: string }[] | null;
}) => {
    const { data, error } = await api.api.private["broadcast-templates"].post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const updateTemplateFn = async ({
    id,
    ...body
}: {
    id: number;
    name?: string;
    content?: string;
    media?: { type: "photo" | "video" | "document"; url: string }[] | null;
    buttons?: { text: string; url: string }[] | null;
}) => {
    const { data, error } = await api.api.private["broadcast-templates"]({ id }).patch(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const deleteTemplateFn = async (id: number) => {
    const { data, error } = await api.api.private["broadcast-templates"]({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

// --- Hooks ---

export const useCreateTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["templates", "create"],
        mutationFn: createTemplateFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useUpdateTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["templates", "update"],
        mutationFn: updateTemplateFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["templates", "delete"],
        mutationFn: deleteTemplateFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
