import {
	staffListQueryOptions,
	useCreateStaff,
	useUpdateStaff,
	useDeleteStaff,
} from "@/api/staff.api";
import { rolesListQueryOptions } from "@/api/roles.api";
import { getStaffColumns } from "./staff-columns";
import { CreateStaffDialog } from "./create-staff-dialog";
import { DataTable, DataTableSkeleton, Button } from "@jahonbozor/ui";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { Permission } from "@jahonbozor/schemas";
import { Plus } from "lucide-react";

export function StaffTab() {
	const { t } = useTranslation("settings");
	const currentUser = useAuthStore((s) => s.user);
	const [isReady, setIsReady] = useState(false);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const canCreate = useHasPermission(Permission.STAFF_CREATE);
	const canDelete = useHasPermission(Permission.STAFF_DELETE);

	useEffect(() => {
		const timer = setTimeout(() => setIsReady(true), 150);
		return () => clearTimeout(timer);
	}, []);

	const { data: staffData, isLoading: isStaffLoading } = useQuery(
		staffListQueryOptions({ limit: 100 }),
	);

	const { data: rolesData, isLoading: isRolesLoading } = useQuery(
		rolesListQueryOptions({ limit: 100 }),
	);

	const createStaff = useCreateStaff();
	const updateStaff = useUpdateStaff();
	const deleteStaff = useDeleteStaff();

	const isLoading = isStaffLoading || isRolesLoading || !isReady;
	const staff = staffData?.staff ?? [];
	const roles = rolesData?.roles ?? [];

	// Вес роли = количество permissions
	const getRoleWeight = useCallback((roleId: number): number => {
		const role = roles.find((r) => r.id === roleId);
		return role?.permissions.length ?? 0;
	}, [roles]);

	const currentUserRoleWeight = useMemo(() => 
		currentUser ? getRoleWeight(currentUser.roleId) : 0
	, [currentUser, getRoleWeight]);

	const actions = useMemo(
		() => ({
			onDelete: (id: number) => deleteStaff.mutate(id),
			canDelete: (id: number) => {
				if (id === currentUser?.id) return false; // Нельзя удалить себя
				
				const targetStaff = staff.find(s => s.id === id);
				if (targetStaff && getRoleWeight(targetStaff.roleId) >= currentUserRoleWeight) {
					// Нельзя удалить сотрудника с такой же или более высокой ролью
					// (Если только это не супер-админ, но у нас вес на этом завязан)
					return false;
				}

				return canDelete;
			},
		}),
		[deleteStaff, canDelete, currentUser, staff, getRoleWeight, currentUserRoleWeight],
	);

	const columns = useMemo(
		() => getStaffColumns(t, actions, roles, currentUser),
		[t, actions, roles, currentUser],
	);

	const handleCellEdit = useCallback(
		async (rowIndex: number, columnId: string, value: unknown) => {
			const staffMember = staff[rowIndex];
			if (!staffMember) return;
			const body: Record<string, unknown> = {};
			body[columnId] = value;
			updateStaff.mutate({ id: staffMember.id, ...body });
		},
		[staff, updateStaff],
	);

	const handleCreateStaff = async (data: any) => {
		await createStaff.mutateAsync({
			fullname: data.fullname,
			username: data.username,
			password: data.password,
			roleId: Number(data.roleId),
			telegramId: data.telegramId || null,
		});
	};

	const translations: DataTableTranslations = {
		search: t("common:search"),
		noResults: t("staff_empty"),
		columns: t("common:table_columns"),
		rowsPerPage: t("common:per_page"),
		showAll: t("common:table_show_all"),
		previous: t("common:table_previous"),
		next: t("common:table_next"),
		filterAll: t("common:filter_all"),
		filterMin: t("common:filter_min"),
		filterMax: t("common:filter_max"),
		filter: t("common:filter"),
	};

	return (
		<div className="flex-1 flex flex-col min-h-0 space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">{t("tab_staff")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("staff_description")}
					</p>
				</div>
				{canCreate && (
					<Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
						<Plus className="h-4 w-4" />
						{t("create_staff")}
					</Button>
				)}
			</div>

			{isLoading ? (
				<DataTableSkeleton columns={6} rows={10} className="flex-1" />
			) : (
				<DataTable
					className="flex-1"
					columns={columns}
					data={staff}
					pagination
					defaultPageSize={20}
					pageSizeOptions={[10, 20, 50]}
					enableShowAll
					enableSorting
					enableGlobalSearch
					enableFiltering
					enableColumnVisibility
					enableColumnResizing
					enableEditing
					onCellEdit={handleCellEdit}
					translations={translations}
				/>
			)}

			<CreateStaffDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onSave={handleCreateStaff}
				roles={roles}
				currentUserRoleWeight={currentUserRoleWeight}
				getRoleWeight={getRoleWeight}
			/>
		</div>
	);
}
