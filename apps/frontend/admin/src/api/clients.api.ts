import { api } from "@/api/client";
import type { AdminUserItem } from "@jahonbozor/schemas/src/users";
import {
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@jahonbozor/ui";

export const clientKeys = {
    all: ["clients"] as const,
    lists: () => [...clientKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) =>
        [...clientKeys.lists(), params] as const,
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
                    includeDeleted: false,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; users: AdminUserItem[] };
        },
    });

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
    username: string;
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
    username?: string;
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
        mutationFn: createClientFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useUpdateClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateClientFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useDeleteClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteClientFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};

export const useRestoreClient = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreClientFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
        },
        onError: () => {
            toast.error("Xatolik yuz berdi");
        },
    });
};
