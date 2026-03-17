import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@jahonbozor/ui";

import { api } from "@/api/client";
import { i18n } from "@/i18n/config";

import type { Permission } from "@jahonbozor/schemas";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";

// --- Query Keys ---
export const roleKeys = {
    all: ["roles"] as const,
    lists: () => [...roleKeys.all, "list"] as const,
    list: (params?: Record<string, unknown>) => [...roleKeys.lists(), params] as const,
    details: () => [...roleKeys.all, "detail"] as const,
    detail: (id: number) => [...roleKeys.details(), id] as const,
};

// --- Query Options ---
export const rolesListQueryOptions = (params?: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    includeStaffCount?: boolean;
}) =>
    queryOptions({
        queryKey: roleKeys.list(params),
        queryFn: async (): Promise<{ count: number; roles: RoleItem[] }> => {
            const { data, error } = await api.api.private.staff.roles.get({
                query: {
                    page: 1,
                    limit: 100,
                    includeStaffCount: true,
                    ...params,
                },
            });
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as { count: number; roles: RoleItem[] };
        },
    });

export const roleDetailQueryOptions = (id: number) =>
    queryOptions({
        queryKey: roleKeys.detail(id),
        queryFn: async (): Promise<RoleItem> => {
            const { data, error } = await api.api.private.staff.roles({ id }).get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as RoleItem;
        },
        enabled: id > 0,
    });

// --- Mutation Functions ---
export const createRoleFn = async (body: { name: string; permissions: string[] }) => {
    const { data, error } = await api.api.private.staff.roles.post({
        name: body.name,
        permissions: body.permissions as Permission[],
    });
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as RoleItem;
};

export const updateRoleFn = async ({
    id,
    ...body
}: {
    id: number;
    name?: string;
    permissions?: string[];
}) => {
    const updateData: { name?: string; permissions?: Permission[] } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.permissions !== undefined) updateData.permissions = body.permissions as Permission[];

    const { data, error } = await api.api.private.staff.roles({ id }).patch(updateData);
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data as RoleItem;
};

export const deleteRoleFn = async (id: number) => {
    const { data, error } = await api.api.private.staff.roles({ id }).delete();
    if (error) throw error;
    if (!data.success) throw new Error("Request failed");
    return data.data;
};

// --- Hooks ---
export const useCreateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRoleFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useUpdateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateRoleFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};

export const useDeleteRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteRoleFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: roleKeys.all });
        },
        onError: () => {
            toast.error(i18n.t("error"));
        },
    });
};
