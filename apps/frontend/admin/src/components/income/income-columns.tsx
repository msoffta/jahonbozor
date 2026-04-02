import { format } from "date-fns";

import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import type { HistoryEntryItem } from "@jahonbozor/schemas/src/products/product-history.dto";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export function getIncomeColumns(
    t: TFunction,
    products: AdminProductItem[],
): ColumnDef<HistoryEntryItem, unknown>[] {
    const selectOptions = products.map((p) => ({
        label: p.name,
        value: String(p.id),
    }));

    return [
        {
            accessorKey: "id",
            header: t("income_id"),
            size: 60,
            meta: { align: "center" as const },
        },
        {
            id: "product",
            accessorFn: (row) => {
                if (!row.product) return "—";
                const isDeleted =
                    row.product.deletedAt !== null && row.product.deletedAt !== undefined;
                return isDeleted
                    ? `${row.product.name} (${t("status_deleted")})`
                    : row.product.name;
            },
            header: t("income_product"),
            size: 200,
            meta: {
                flex: 2,
                editable: true,
                inputType: "combobox" as const,
                selectOptions,
                editValueAccessor: (row: HistoryEntryItem) =>
                    row.productId ? String(row.productId) : "",
            },
        },
        {
            accessorKey: "quantity",
            header: t("income_quantity"),
            size: 120,
            cell: ({ getValue }) => getValue<number | null>()?.toLocaleString() ?? "—",
            meta: {
                flex: 1,
                align: "right" as const,
                editable: true,
                inputType: "number" as const,
            },
        },
        {
            accessorKey: "changeReason",
            header: t("income_reason"),
            size: 200,
            cell: ({ getValue }) => getValue<string | null>() ?? "—",
            meta: { flex: 2, editable: true, inputType: "text" as const },
        },
        {
            id: "staff",
            accessorFn: (row) => row.staff?.fullname ?? "—",
            header: t("income_staff"),
            size: 140,
            meta: { flex: 1 },
        },
        {
            accessorKey: "createdAt",
            header: t("income_date"),
            size: 140,
            cell: ({ getValue }) => {
                const val = getValue<Date | string>();
                return val ? format(new Date(val), "dd.MM.yyyy HH:mm") : "—";
            },
            meta: {
                flex: 1,
                editable: true,
                inputType: "datepicker" as const,
                showTime: true,
            },
        },
    ];
}
