import { RotateCcw, Trash2 } from "lucide-react";

import { Badge, Button, motion } from "@jahonbozor/ui";

import type { AdminUserItem } from "@jahonbozor/schemas/src/users";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export interface ClientActions {
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

interface ClientColumnsOptions {
    canDelete?: boolean;
}

export function getClientColumns(
    t: TFunction,
    actions: ClientActions,
    options?: ClientColumnsOptions,
): ColumnDef<AdminUserItem, unknown>[] {
    const { canDelete = true } = options ?? {};

    const columns: ColumnDef<AdminUserItem, unknown>[] = [
        {
            accessorKey: "id",
            header: t("client_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            accessorKey: "fullname",
            header: t("client_fullname"),
            size: 200,
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "username",
            header: t("client_username"),
            size: 150,
            meta: { flex: 1, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "phone",
            header: t("client_phone"),
            size: 150,
            cell: ({ getValue }) => getValue<string | null>() ?? "—",
            meta: { flex: 1, editable: true, inputType: "text" as const },
        },
        {
            accessorKey: "language",
            header: t("client_language"),
            size: 100,
            cell: ({ getValue }) => {
                const lang = getValue<string>();
                return lang === "ru" ? t("common:russian") : t("common:uzbek");
            },
            meta: {
                flex: 1,
                editable: true,
                inputType: "select" as const,
                selectOptions: [
                    { label: t("common:russian"), value: "ru" },
                    { label: t("common:uzbek"), value: "uz" },
                ],
            },
        },
        {
            id: "status",
            accessorFn: (row) => (row.deletedAt ? "deleted" : "active"),
            header: t("client_status"),
            size: 100,
            cell: ({ row }) => {
                const isDeleted = row.original.deletedAt !== null;
                return (
                    <Badge variant={isDeleted ? "destructive" : "default"}>
                        {isDeleted ? t("status_deleted") : t("status_active")}
                    </Badge>
                );
            },
            meta: {
                filterVariant: "select" as const,
                filterOptions: [
                    { label: t("status_active"), value: "active" },
                    { label: t("status_deleted"), value: "deleted" },
                ],
            },
        },
        {
            accessorKey: "createdAt",
            header: t("client_created"),
            size: 140,
            cell: ({ getValue }) => new Date(getValue<Date | string>()).toLocaleDateString(),
        },
    ];

    // Only add actions column if user has delete permission
    if (canDelete) {
        columns.push({
            id: "actions",
            header: t("client_actions"),
            size: 100,
            meta: { align: "center" as const },
            cell: ({ row }) => {
                const isDeleted = row.original.deletedAt !== null;
                return (
                    <motion.div
                        whileTap={{ scale: 0.9 }}
                        className="inline-flex w-full justify-center"
                    >
                        {isDeleted ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-primary h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    actions.onRestore(row.original.id);
                                }}
                                title={t("action_restore")}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    actions.onDelete(row.original.id);
                                }}
                                title={t("action_delete")}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </motion.div>
                );
            },
        });
    }

    return columns;
}
