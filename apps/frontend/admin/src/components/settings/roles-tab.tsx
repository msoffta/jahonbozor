import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    motion,
    useIsMobile,
} from "@jahonbozor/ui";

import {
    rolesListQueryOptions,
    useCreateRole,
    useDeleteRole,
    useUpdateRole,
} from "@/api/roles.api";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

import { CreateRoleDialog } from "./create-role-dialog";
import { EditPermissionsDrawer } from "./edit-permissions-drawer";
import { getRolesColumns } from "./roles-columns";

import type { CreateRoleBody } from "@jahonbozor/schemas";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";

export function RolesTab() {
    const { t } = useTranslation("settings");
    const currentUserPermissions = useAuthStore((s) => s.permissions);
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations(t("roles_empty"));
    const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

    const canCreate = useHasPermission(Permission.ROLES_CREATE);
    const canUpdate = useHasPermission(Permission.ROLES_UPDATE);
    const canDelete = useHasPermission(Permission.ROLES_DELETE);

    const { data: rolesData, isLoading: isRolesLoading } = useQuery(
        rolesListQueryOptions({
            page: pagination.pageIndex + 1,
            limit: pagination.pageSize,
            includeStaffCount: true,
        }),
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
                if (role.permissions.length >= currentUserPermissionCount) return false;
                return canDelete;
            },
        }),
        [deleteRole, canDelete, currentUserPermissionCount],
    );

    const columns = useMemo(() => getRolesColumns(t, actions, canUpdate), [t, actions, canUpdate]);

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { "_count.staffs": false, createdAt: false } : {},
        [isMobile],
    );

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
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
            setEditingRole(newRole);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">{t("tab_roles")}</h2>
                    <p className="text-muted-foreground text-sm">{t("roles_description")}</p>
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
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={5} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <DataTable
                            className="flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={roles}
                            pagination
                            manualPagination
                            pageCount={Math.ceil((rolesData?.count ?? 0) / pagination.pageSize)}
                            onPaginationChange={setPagination}
                            defaultPageSize={20}
                            pageSizeOptions={[10, 20, 50]}
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
