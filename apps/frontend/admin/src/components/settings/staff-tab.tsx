import {
	staffListQueryOptions,
	useCreateStaff,
	useUpdateStaff,
	useDeleteStaff,
} from "@/api/staff.api";
import { rolesListQueryOptions } from "@/api/roles.api";
import { getStaffColumns } from "./staff-columns";
import { CreateStaffDialog } from "./create-staff-dialog";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Permission } from "@jahonbozor/schemas";
import { AnimatePresence, DataTable, DataTableSkeleton, Button, motion } from "@jahonbozor/ui";
import { Plus } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";

export function StaffTab() {
	const { t } = useTranslation("settings");
	const currentUser = useAuthStore((s) => s.user);
	const isReady = useDeferredReady();
	const translations = useDataTableTranslations("staff_empty");
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const canCreate = useHasPermission(Permission.STAFF_CREATE);
	const canDelete = useHasPermission(Permission.STAFF_DELETE);

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

	const handleCreateStaff = async (data: { fullname: string; username: string; password: string; roleId: number; telegramId?: string | null }) => {
		await createStaff.mutateAsync({
			fullname: data.fullname,
			username: data.username,
			password: data.password,
			roleId: Number(data.roleId),
			telegramId: data.telegramId || null,
		});
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

			<AnimatePresence mode="wait">
				{isLoading ? (
					<motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<DataTableSkeleton columns={6} rows={10} className="flex-1" />
					</motion.div>
				) : (
					<motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
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
					</motion.div>
				)}
			</AnimatePresence>

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
