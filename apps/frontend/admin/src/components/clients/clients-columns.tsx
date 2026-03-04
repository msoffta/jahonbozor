import type { AdminUserItem } from "@jahonbozor/schemas/src/users";
import { Badge, Button, motion } from "@jahonbozor/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { RotateCcw, Trash2 } from "lucide-react";

export interface ClientActions {
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

export function getClientColumns(
    t: TFunction,
    actions: ClientActions,
): ColumnDef<AdminUserItem, unknown>[] {
    return [
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
                return lang === "ru" ? "Русский" : "O'zbekcha";
            },
            meta: { flex: 1, editable: true, inputType: "text" as const },
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
            cell: ({ getValue }) =>
                new Date(getValue<Date | string>()).toLocaleDateString(),
        },
        {
            id: "actions",
            header: t("client_actions"),
            size: 100,
            meta: { align: "center" as const },
            cell: ({ row }) => {
                const isDeleted = row.original.deletedAt !== null;
                return (
                    <motion.div
                        whileTap={{ scale: 0.9 }}
                        className="inline-flex justify-center w-full"
                    >
                        {isDeleted ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() =>
                                    actions.onRestore(row.original.id)
                                }
                                title={t("action_restore")}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                    actions.onDelete(row.original.id)
                                }
                                title={t("action_delete")}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </motion.div>
                );
            },
        },
    ];
}
