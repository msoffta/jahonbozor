import {
    infiniteQueryOptions,
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { StaffItem } from "@jahonbozor/schemas/src/staff";

// --- Query Keys ---
export const staffKeys = {
    all: ["staff"] as const,
    lists: () => [...staffKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...staffKeys.lists(), params] as const,
    details: () => [...staffKeys.all, "detail"] as const,
    detail: (id: number) => [...staffKeys.details(), id] as const,
};

// --- Query Options ---
export const staffListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    roleId?: number;
}) =>
    queryOptions({
        queryKey: staffKeys.list(params),
        queryFn: async (): Promise<{ count: number; staff: StaffItem[] }> => {
            const { data, error } = await api.api.private.staff.get({
                query: {
                    page: 1,
                    limit: 100,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; staff: StaffItem[] };
        },
    });

export const staffInfiniteQueryOptions = (params?: {
    limit?: number;
    searchQuery?: string;
    roleId?: number;
}) =>
    infiniteQueryOptions({
        queryKey: staffKeys.list({ ...params, infinite: true }),
        queryFn: async ({ pageParam }): Promise<{ count: number; staff: StaffItem[] }> => {
            const { data, error } = await api.api.private.staff.get({
                query: {
                    page: pageParam,
                    limit: params?.limit ?? 1000,
                    sortBy: "id",
                    sortOrder: "asc" as const,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; staff: StaffItem[] };
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => {
            const loaded = lastPageParam * (params?.limit ?? 50);
            return loaded < lastPage.count ? lastPageParam + 1 : undefined;
        },
    });

export const staffDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: staffKeys.detail(id),
        queryFn: async (): Promise<StaffItem> => {
            const { data, error } = await api.api.private.staff({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as StaffItem;
        },
        enabled: id > 0,
    });

// --- Mutation Functions ---
export const createStaffFn = async (body: {
    fullname: string;
    username: string;
    password: string;
    telegramId?: string | null;
    roleId: number;
}) => {
    const requestBody = {
        fullname: body.fullname,
        username: body.username,
        password: body.password,
        roleId: body.roleId,
        telegramId: body.telegramId ?? "",
    };

    const { data, error } = await api.api.private.staff.post(requestBody);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as StaffItem;
};

export const updateStaffFn = async ({
    id,
    ...body
}: {
    id: number;
    fullname?: string;
    username?: string;
    password?: string;
    telegramId?: string | null;
    roleId?: number;
}) => {
    const requestBody: {
        fullname?: string;
        username?: string;
        password?: string;
        telegramId?: string;
        roleId?: number;
    } = {};

    if (body.fullname !== undefined) requestBody.fullname = body.fullname;
    if (body.username !== undefined) requestBody.username = body.username;
    if (body.password !== undefined) requestBody.password = body.password;
    if (body.roleId !== undefined) requestBody.roleId = body.roleId;
    if (body.telegramId) requestBody.telegramId = body.telegramId;

    const { data, error } = await api.api.private.staff({ id }).patch(requestBody);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as StaffItem;
};

export const deleteStaffFn = async (id: number) => {
    const { data, error } = await api.api.private.staff({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

// --- Hooks ---
export const useCreateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["staff", "create"],
        mutationFn: createStaffFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: staffKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useUpdateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["staff", "update"],
        mutationFn: updateStaffFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: staffKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["staff", "delete"],
        mutationFn: deleteStaffFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: staffKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
