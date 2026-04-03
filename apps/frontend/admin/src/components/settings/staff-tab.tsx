import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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

import { rolesListQueryOptions } from "@/api/roles.api";
import {
    staffInfiniteQueryOptions,
    useCreateStaff,
    useDeleteStaff,
    useUpdateStaff,
} from "@/api/staff.api";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

import { CreateStaffDialog } from "./create-staff-dialog";
import { getStaffColumns } from "./staff-columns";

export function StaffTab() {
    const { t } = useTranslation("settings");
    const currentUser = useAuthStore((s) => s.user);
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations(t("staff_empty"));
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const canCreate = useHasPermission(Permission.STAFF_CREATE);
    const canDelete = useHasPermission(Permission.STAFF_DELETE);

    const {
        data: staffData,
        isLoading: isStaffLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(staffInfiniteQueryOptions({ searchQuery }));

    const { data: rolesData, isLoading: isRolesLoading } = useQuery(
        rolesListQueryOptions({ limit: 100 }),
    );

    const createStaff = useCreateStaff();
    const updateStaff = useUpdateStaff();
    const deleteStaff = useDeleteStaff();

    const isLoading = isStaffLoading || isRolesLoading || !isReady;
    const staff = useMemo(() => staffData?.pages.flatMap((p) => p.staff) ?? [], [staffData]);
    const totalCount = staffData?.pages[0]?.count ?? 0;
    const roles = rolesData?.roles ?? [];

    // Вес роли = количество permissions
    const getRoleWeight = useCallback(
        (roleId: number): number => {
            const role = roles.find((r) => r.id === roleId);
            return role?.permissions.length ?? 0;
        },
        [roles],
    );

    const currentUserRoleWeight = useMemo(
        () => (currentUser ? getRoleWeight(currentUser.roleId) : 0),
        [currentUser, getRoleWeight],
    );

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => deleteStaff.mutate(id),
            canDelete: (id: number) => {
                if (id === currentUser?.id) return false; // Нельзя удалить себя

                const targetStaff = staff.find((s) => s.id === id);
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

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { username: false, "role.permissions": false, createdAt: false } : {},
        [isMobile],
    );

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
            const staffMember = staff[rowIndex];
            if (!staffMember) return;
            const body: Record<string, unknown> = {};
            body[columnId] = value;
            updateStaff.mutate({ id: staffMember.id, ...body });
        },
        [staff, updateStaff],
    );

    const handleCreateStaff = async (data: {
        fullname: string;
        username: string;
        password: string;
        roleId: number;
        telegramId?: string | null;
    }) => {
        await createStaff.mutateAsync({
            fullname: data.fullname,
            username: data.username,
            password: data.password,
            roleId: Number(data.roleId),
            telegramId: data.telegramId ?? null,
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">{t("tab_staff")}</h2>
                    <p className="text-muted-foreground text-sm">{t("staff_description")}</p>
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
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={6} rows={10} className="flex-1" />
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
                            data={staff}
                            enableInfiniteScroll
                            onFetchNextPage={fetchNextPage}
                            onFetchAllPages={async () => {
                                let result = await fetchNextPage();
                                while (result.hasNextPage) {
                                    result = await fetchNextPage();
                                }
                            }}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            totalCount={totalCount}
                            enableSorting
                            enableGlobalSearch
                            onSearchQueryChange={setSearchQuery}
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            enableEditing
                            onCellEdit={handleCellEdit}
                            onRowDelete={
                                canDelete
                                    ? (rowIndex) => {
                                          const id = staff[rowIndex].id;
                                          deleteStaff.mutate(id);
                                          return id;
                                      }
                                    : undefined
                            }
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
