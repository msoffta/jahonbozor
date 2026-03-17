import { Edit, Trash2 } from "lucide-react";

import { Badge, Button, motion } from "@jahonbozor/ui";

import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

type RoleItemWithCount = RoleItem & {
    _count?: { staffs: number };
};

export interface RolesActions {
    onEdit: (role: RoleItem) => void;
    onDelete: (id: number) => void;
    canDelete: (role: RoleItem) => boolean;
}

export function getRolesColumns(
    t: TFunction,
    actions: RolesActions,
    canUpdate: boolean,
): ColumnDef<RoleItem, unknown>[] {
    return [
        {
            accessorKey: "id",
            header: t("role_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "name",
            header: t("role_name"),
            size: 200,
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "permissions",
            header: t("role_permissions"),
            size: 250,
            cell: ({ row }) => {
                const permissions = row.original.permissions || [];
                const displayCount = 2;
                const remaining = Math.max(0, permissions.length - displayCount);

                return (
                    <div className="flex flex-wrap gap-1.5">
                        {permissions.slice(0, displayCount).map((perm) => (
                            <Badge
                                key={perm}
                                variant="outline"
                                className="bg-background border-muted-foreground/20 h-5 px-1.5 py-0 text-[10px]"
                            >
                                {perm.split(":").pop()}
                            </Badge>
                        ))}
                        {remaining > 0 && (
                            <Badge
                                variant="secondary"
                                className="bg-muted/50 h-5 px-1.5 py-0 text-[10px]"
                            >
                                +{remaining}
                            </Badge>
                        )}
                    </div>
                );
            },
            meta: { flex: 3 },
        },
        {
            accessorKey: "_count.staffs",
            header: t("role_staff_count"),
            size: 100,
            cell: ({ row }) => {
                const count = (row.original as RoleItemWithCount)._count?.staffs ?? 0;
                return <div className="text-muted-foreground text-center">{count}</div>;
            },
            meta: { align: "center" as const },
        },
        {
            accessorKey: "createdAt",
            header: t("role_created"),
            size: 140,
            cell: ({ getValue }) => new Date(getValue<Date | string>()).toLocaleDateString(),
        },
        {
            id: "actions",
            header: t("role_actions"),
            size: 100,
            meta: { align: "center" as const },
            cell: ({ row }) => {
                const canDeleteThis = actions.canDelete(row.original);

                return (
                    <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                            <motion.div whileTap={{ scale: 0.9 }}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-primary h-8 w-8"
                                    onClick={() => actions.onEdit(row.original)}
                                    title={t("role_edit_permissions")}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        )}
                        <motion.div whileTap={canDeleteThis ? { scale: 0.9 } : undefined}>
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
                                title={
                                    canDeleteThis
                                        ? t("role_delete")
                                        : t("role_cannot_delete_higher")
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </div>
                );
            },
        },
    ];
}
