import {
	rolesListQueryOptions,
	useCreateRole,
	useUpdateRole,
	useDeleteRole,
} from "@/api/roles.api";
import { getRolesColumns } from "./roles-columns";
import { EditPermissionsDrawer } from "./edit-permissions-drawer";
import { CreateRoleDialog } from "./create-role-dialog";
import { DataTable, DataTableSkeleton, Button } from "@jahonbozor/ui";
import type { DataTableTranslations } from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { Permission } from "@jahonbozor/schemas";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import { Plus } from "lucide-react";

export function RolesTab() {
	const { t } = useTranslation("settings");
	const currentUserPermissions = useAuthStore((s) => s.permissions);
	const [isReady, setIsReady] = useState(false);
	const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const canCreate = useHasPermission(Permission.ROLES_CREATE);
	const canUpdate = useHasPermission(Permission.ROLES_UPDATE);
	const canDelete = useHasPermission(Permission.ROLES_DELETE);

	useEffect(() => {
		const timer = setTimeout(() => setIsReady(true), 150);
		return () => clearTimeout(timer);
	}, []);

	const { data: rolesData, isLoading: isRolesLoading } = useQuery(
		rolesListQueryOptions({ limit: 100, includeStaffCount: true }),
	);

	const createRole = useCreateRole();
	const updateRole = useUpdateRole();
	const deleteRole = useDeleteRole();

	const isLoading = isRolesLoading || !isReady;
	const roles = rolesData?.roles ?? [];

	const currentUserPermissionCount = currentUserPermissions.length;

	const actions = useMemo(
		() => ({
			onEdit: (role: RoleItem) => setEditingRole(role),
			onDelete: (id: number) => deleteRole.mutate(id),
			canDelete: (role: RoleItem) => {
				// Нельзя удалить роль с >= количеством прав
				if (role.permissions.length >= currentUserPermissionCount)
					return false;
				return canDelete;
			},
		}),
		[deleteRole, canDelete, currentUserPermissionCount],
	);

	const columns = useMemo(
		() => getRolesColumns(t, actions, canUpdate),
		[t, actions, canUpdate],
	);

	const handleCellEdit = useCallback(
		async (rowIndex: number, columnId: string, value: unknown) => {
			const role = roles[rowIndex];
			if (!role) return;

			const body: Record<string, unknown> = {};
			body[columnId] = value;

			updateRole.mutate({ id: role.id, ...body });
		},
		[roles, updateRole],
	);

	const handleCreateRole = async (data: any) => {
		const newRole = await createRole.mutateAsync({
			name: data.name,
			permissions: [],
		});
		// Автоматически открываем редактор прав для только что созданной роли
		if (newRole) {
			setEditingRole(newRole as RoleItem);
		}
	};

	const translations: DataTableTranslations = {
		search: t("common:search"),
		noResults: t("roles_empty"),
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
					<h2 className="text-lg font-semibold">{t("tab_roles")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("roles_description")}
					</p>
				</div>
				{canCreate && (
					<Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
						<Plus className="h-4 w-4" />
						{t("create_role")}
					</Button>
				)}
			</div>

			{isLoading ? (
				<DataTableSkeleton columns={5} rows={10} className="flex-1" />
			) : (
				<DataTable
					className="flex-1"
					columns={columns}
					data={roles}
					pagination
					defaultPageSize={20}
					pageSizeOptions={[10, 20, 50]}
					enableShowAll
					enableSorting
					enableGlobalSearch
					enableColumnVisibility
					enableColumnResizing
					enableEditing
					onCellEdit={handleCellEdit}
					translations={translations}
				/>
			)}

			<EditPermissionsDrawer
				role={editingRole}
				open={editingRole !== null}
				onOpenChange={(open) => !open && setEditingRole(null)}
				onSave={async (roleId, permissions) => {
					await updateRole.mutateAsync({ id: roleId, permissions });
					setEditingRole(null);
				}}
			/>

			<CreateRoleDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onSave={handleCreateRole}
			/>
		</div>
	);
}
