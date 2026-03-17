import {
	rolesListQueryOptions,
	useCreateRole,
	useUpdateRole,
	useDeleteRole,
} from "@/api/roles.api";
import { getRolesColumns } from "./roles-columns";
import { EditPermissionsDrawer } from "./edit-permissions-drawer";
import { CreateRoleDialog } from "./create-role-dialog";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Permission } from "@jahonbozor/schemas";
import type { CreateRoleBody } from "@jahonbozor/schemas";
import { AnimatePresence, DataTable, DataTableSkeleton, Button, motion } from "@jahonbozor/ui";
import { Plus } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";

export function RolesTab() {
	const { t } = useTranslation("settings");
	const currentUserPermissions = useAuthStore((s) => s.permissions);
	const isReady = useDeferredReady();
	const translations = useDataTableTranslations("roles_empty");
	const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const canCreate = useHasPermission(Permission.ROLES_CREATE);
	const canUpdate = useHasPermission(Permission.ROLES_UPDATE);
	const canDelete = useHasPermission(Permission.ROLES_DELETE);

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

	const handleCreateRole = async (data: CreateRoleBody) => {
		const newRole = await createRole.mutateAsync({
			name: data.name,
			permissions: [],
		});
		// Автоматически открываем редактор прав для только что созданной роли
		if (newRole) {
			setEditingRole(newRole as RoleItem);
		}
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

			<AnimatePresence mode="wait">
				{isLoading ? (
					<motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<DataTableSkeleton columns={5} rows={10} className="flex-1" />
					</motion.div>
				) : (
					<motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
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
					</motion.div>
				)}
			</AnimatePresence>

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
