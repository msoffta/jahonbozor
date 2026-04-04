import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

export const sessionKeys = {
    all: ["sessions"] as const,
    lists: () => [...sessionKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...sessionKeys.lists(), params] as const,
    details: () => [...sessionKeys.all, "detail"] as const,
    detail: (id: number) => [...sessionKeys.details(), id] as const,
};

export const sessionsListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
}) =>
    queryOptions({
        queryKey: sessionKeys.list(params),
        queryFn: async () => {
            const { data, error } = await api.api.private["telegram-sessions"].get({
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
                sessions: { id: number; name: string; phone: string; status: string }[];
            };
        },
    });

export const sessionDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: sessionKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.api.private["telegram-sessions"]({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as Record<string, unknown>;
        },
        enabled: id > 0,
    });

export const qrStatusQueryOptions = (token: string, enabled: boolean) =>
    queryOptions({
        queryKey: [...sessionKeys.all, "qr-status", token] as const,
        queryFn: async () => {
            const { data, error } = await api.api.private["telegram-sessions"].qr.status.get({
                query: { token },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as { status: string; sessionId?: number };
        },
        enabled,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "waiting" || status === "needs_password" ? 2000 : false;
        },
    });

// --- Mutation functions ---

export const startQrLoginFn = async (body: { name: string; phone: string }) => {
    const { data, error } = await api.api.private["telegram-sessions"].qr.start.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as { qrUrl: string; token: string };
};

export const submitQrPasswordFn = async (body: { token: string; password: string }) => {
    const { data, error } = await api.api.private["telegram-sessions"].qr.password.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as { status: string };
};

export const useSubmitQrPassword = () => {
    return useMutation({
        mutationKey: ["sessions", "submit-password"],
        mutationFn: submitQrPasswordFn,
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const disconnectSessionFn = async (id: number) => {
    const { data, error } = await api.api.private["telegram-sessions"]({ id }).disconnect.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const reconnectSessionFn = async (id: number) => {
    const { data, error } = await api.api.private["telegram-sessions"]({ id }).reconnect.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const deleteSessionFn = async (id: number) => {
    const { data, error } = await api.api.private["telegram-sessions"]({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

// --- Hooks ---

export const useStartQrLogin = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sessions", "start-qr-login"],
        mutationFn: startQrLoginFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDisconnectSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sessions", "disconnect"],
        mutationFn: disconnectSessionFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useReconnectSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sessions", "reconnect"],
        mutationFn: reconnectSessionFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sessions", "delete"],
        mutationFn: deleteSessionFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
