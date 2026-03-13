import { api } from "@/api/client";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import type { Permission } from "@jahonbozor/schemas";
import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

// --- Query Keys ---
export const roleKeys = {
	all: ["roles"] as const,
	list: (params?: Record<string, unknown>) =>
		[...roleKeys.all, "list", params] as const,
	detail: (id: number) => [...roleKeys.all, "detail", id] as const,
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
export const createRoleFn = async (body: {
	name: string;
	permissions: string[];
}) => {
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
	});
};

export const useUpdateRole = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateRoleFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.all });
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
	});
};
