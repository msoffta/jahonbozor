import {
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { AdminUserItem } from "@jahonbozor/schemas/src/users";

interface ClientsInfiniteCache {
    pages: { count: number; users: AdminUserItem[] }[];
    pageParams: number[];
}

export const clientKeys = {
    all: ["clients"] as const,
    lists: () => [...clientKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...clientKeys.lists(), params] as const,
    details: () => [...clientKeys.all, "detail"] as const,
    detail: (id: number) => [...clientKeys.details(), id] as const,
};

export const clientsListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    includeOrders?: boolean;
    includeDeleted?: boolean;
}) =>
    queryOptions({
        queryKey: clientKeys.list(params),
        queryFn: async (): Promise<{
            count: number;
            users: AdminUserItem[];
        }> => {
            const { data, error } = await api.api.private.users.get({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    includeDeleted: false,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; users: AdminUserItem[] };
        },
    });

export const clientsInfiniteQueryOptions = (params?: {
    limit?: number;
    searchQuery?: string;
    includeOrders?: boolean;
    includeDeleted?: boolean;
}) =>
    infiniteQueryOptions({
        queryKey: clientKeys.list({ ...params, infinite: true }),
        queryFn: async ({
            pageParam,
        }): Promise<{
            count: number;
            users: AdminUserItem[];
        }> => {
            const { data, error } = await api.api.private.users.get({
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
            return data.data as { count: number; users: AdminUserItem[] };
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params?.limit ?? 10000);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
        },
    });

export const searchClientsFn = async (
    query: string,
): Promise<{ label: string; value: string }[]> => {
    const { data, error } = await api.api.private.users.get({
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
    const result = data.data as { count: number; users: AdminUserItem[] };
    return result.users.map((u) => ({ label: u.fullname, value: String(u.id) }));
};

export const clientDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: clientKeys.detail(id),
        queryFn: async (): Promise<AdminUserItem> => {
            const { data, error } = await api.api.private.users({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as AdminUserItem;
        },
        enabled: id > 0,
    });

// --- Mutation functions ---

export const createClientFn = async (body: {
    fullname: string;
    phone: string | null;
    telegramId: string | null;
    photo: string | null;
    language: "uz" | "ru";
}) => {
    const { data, error } = await api.api.private.users.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminUserItem;
};

export const updateClientFn = async ({
    id,
    ...body
}: {
    id: number;
    fullname?: string;
    phone?: string | null;
    telegramId?: string | null;
    photo?: string | null;
    language?: "uz" | "ru";
}) => {
    const { data, error } = await api.api.private.users({ id }).put(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminUserItem;
};

export const deleteClientFn = async (id: number) => {
    const { data, error } = await api.api.private.users({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminUserItem;
};

export const restoreClientFn = async (id: number) => {
    const { data, error } = await api.api.private.users({ id }).restore.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as AdminUserItem;
};

// --- Hooks ---

export const useCreateClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clients", "create"],
        mutationFn: createClientFn,
        onSuccess: (newClient) => {
            queryClient.setQueriesData<ClientsInfiniteCache>(
                { queryKey: clientKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    const lastIdx = old.pages.length - 1;
                    return {
                        ...old,
                        pages: old.pages.map((page, index) =>
                            index === lastIdx
                                ? {
                                      count: page.count + 1,
                                      users: [...page.users, newClient],
                                  }
                                : page,
                        ),
                    };
                },
            );
            queryClient.setQueryData(clientKeys.detail(newClient.id), newClient);
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useUpdateClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clients", "update"],
        mutationFn: updateClientFn,
        onSuccess: (updatedClient) => {
            queryClient.setQueriesData<ClientsInfiniteCache>(
                { queryKey: clientKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            users: page.users.map((u) =>
                                u.id === updatedClient.id ? updatedClient : u,
                            ),
                        })),
                    };
                },
            );
            queryClient.setQueryData(clientKeys.detail(updatedClient.id), updatedClient);
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clients", "delete"],
        mutationFn: deleteClientFn,
        onSuccess: (deletedClient) => {
            const deletedId = deletedClient?.id;
            if (deletedId == null) return;
            queryClient.setQueriesData<ClientsInfiniteCache>(
                { queryKey: clientKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => {
                            const filtered = page.users.filter((u) => u.id !== deletedId);
                            return {
                                count: Math.max(
                                    0,
                                    page.count - (page.users.length - filtered.length),
                                ),
                                users: filtered,
                            };
                        }),
                    };
                },
            );
            queryClient.removeQueries({ queryKey: clientKeys.detail(deletedId) });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useRestoreClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clients", "restore"],
        mutationFn: restoreClientFn,
        onSuccess: (restoredClient) => {
            queryClient.setQueriesData<ClientsInfiniteCache>(
                { queryKey: clientKeys.all },
                (old) => {
                    if (!old?.pages?.length) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            users: page.users.map((u) =>
                                u.id === restoredClient.id
                                    ? { ...u, ...restoredClient, deletedAt: null }
                                    : u,
                            ),
                        })),
                    };
                },
            );
            queryClient.setQueryData(clientKeys.detail(restoredClient.id), restoredClient);
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
