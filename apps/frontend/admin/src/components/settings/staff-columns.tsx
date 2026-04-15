import { Trash2 } from "lucide-react";

import { Badge, Button } from "@jahonbozor/ui";

import type { TokenStaff } from "@jahonbozor/schemas";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import type { StaffItem } from "@jahonbozor/schemas/src/staff";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export interface StaffActions {
    onDelete: (id: number) => void;
    canDelete: (id: number) => boolean;
}

export function getStaffColumns(
    t: TFunction,
    actions: StaffActions,
    roles: RoleItem[],
    currentUser: TokenStaff | null,
): ColumnDef<StaffItem, unknown>[] {
    // Вес роли = количество permissions
    const getRoleWeight = (roleId: number): number => {
        const role = roles.find((r) => r.id === roleId);
        return role?.permissions.length ?? 0;
    };

    const currentUserRoleWeight = currentUser ? getRoleWeight(currentUser.roleId) : 0;

    return [
        {
            accessorKey: "id",
            header: t("staff_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "fullname",
            header: t("staff_fullname"),
            size: 200,
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "username",
            header: t("staff_username"),
            size: 150,
            meta: { flex: 1, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "roleId",
            header: t("staff_role"),
            size: 180,
            cell: ({ row }) => {
                const role = roles.find((r) => r.id === row.original.roleId);
                return (
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="bg-primary/5 text-primary border-primary/20"
                        >
                            {role?.name ?? "—"}
                        </Badge>
                    </div>
                );
            },
            meta: {
                flex: 1,
                editable: true,
                inputType: "select" as const,
                selectOptions: roles.map((role) => ({
                    label: role.name,
                    value: String(role.id),
                    // Блокируем роли "выше" (с большим количеством прав)
                    disabled: getRoleWeight(role.id) > currentUserRoleWeight,
                })),
            },
        },
        {
            accessorKey: "role.permissions",
            header: t("staff_permissions_count"),
            size: 100,
            cell: ({ row }) => {
                const count = row.original.role?.permissions.length ?? 0;
                return <div className="text-muted-foreground text-center">{count}</div>;
            },
            meta: { align: "center" as const },
        },
        {
            accessorKey: "createdAt",
            header: t("staff_created"),
            size: 140,
            cell: ({ getValue }) => new Date(getValue<Date | string>()).toLocaleDateString(),
        },
        {
            id: "actions",
            header: t("staff_actions"),
            size: 80,
            meta: { align: "center" as const },
            cell: ({ row }) => {
                const canDeleteThis = actions.canDelete(row.original.id);
                const isSelf = row.original.id === currentUser?.id;

                return (
                    <div
                        className={`inline-flex w-full justify-center${canDeleteThis ? "transition-transform active:scale-90" : ""}`}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                                canDeleteThis
                                    ? "text-muted-foreground hover:text-destructive"
                                    : "cursor-not-allowed opacity-30"
                            }`}
                            onClick={() => canDeleteThis && actions.onDelete(row.original.id)}
                            disabled={!canDeleteThis}
                            title={isSelf ? t("staff_cannot_delete_self") : t("staff_delete")}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                );
            },
        },
    ];
}
