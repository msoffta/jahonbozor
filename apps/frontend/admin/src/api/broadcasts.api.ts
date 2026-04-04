import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

export const broadcastKeys = {
    all: ["broadcasts"] as const,
    lists: () => [...broadcastKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...broadcastKeys.lists(), params] as const,
    details: () => [...broadcastKeys.all, "detail"] as const,
    detail: (id: number) => [...broadcastKeys.details(), id] as const,
    recipients: (id: number) => [...broadcastKeys.detail(id), "recipients"] as const,
};

export const broadcastsListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
}) =>
    queryOptions({
        queryKey: broadcastKeys.list(params),
        queryFn: async () => {
            const { data, error } = await api.api.private.broadcasts.get({
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
                broadcasts: Record<string, unknown>[];
            };
        },
    });

export const broadcastDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: broadcastKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.api.private.broadcasts({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as Record<string, unknown> & { status: string };
        },
        enabled: id > 0,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === "SENDING" || status === "PAUSED") return 3000;
            if (status === "DRAFT" || status === "SCHEDULED") return 5000;
            return false;
        },
    });

export const broadcastRecipientsQueryOptions = (
    id: number,
    params?: {
        page?: number;
        limit?: number;
    },
) =>
    queryOptions({
        queryKey: [...broadcastKeys.recipients(id), params] as const,
        queryFn: async () => {
            const { data, error } = await api.api.private.broadcasts({ id }).recipients.get({
                query: {
                    page: 1,
                    limit: 20,
                    searchQuery: "",
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as unknown as {
                count: number;
                recipients: Record<string, unknown>[];
            };
        },
        enabled: id > 0,
    });

// --- Mutation functions ---

export const createBroadcastFn = async (body: {
    name: string;
    sendVia: "BOT" | "SESSION";
    recipientUserIds: number[];
    content?: string;
    media?: { type: "photo" | "video" | "document"; url: string }[];
    buttons?: { text: string; url: string }[];
    templateId?: number;
    sessionId?: number;
    scheduledAt?: string;
}) => {
    const { data, error } = await api.api.private.broadcasts.post(body);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const sendBroadcastFn = async (id: number) => {
    const { data, error } = await api.api.private.broadcasts({ id }).send.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const pauseBroadcastFn = async (id: number) => {
    const { data, error } = await api.api.private.broadcasts({ id }).pause.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const resumeBroadcastFn = async (id: number) => {
    const { data, error } = await api.api.private.broadcasts({ id }).resume.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const retryBroadcastFn = async (id: number) => {
    const { data, error } = await api.api.private.broadcasts({ id }).retry.post();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

export const deleteBroadcastFn = async (id: number) => {
    const { data, error } = await api.api.private.broadcasts({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as unknown as Record<string, unknown>;
};

// --- Hooks ---

export const useCreateBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "create"],
        mutationFn: createBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useSendBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "send"],
        mutationFn: sendBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const usePauseBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "pause"],
        mutationFn: pauseBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useResumeBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "resume"],
        mutationFn: resumeBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useRetryBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "retry"],
        mutationFn: retryBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteBroadcast = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["broadcasts", "delete"],
        mutationFn: deleteBroadcastFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
