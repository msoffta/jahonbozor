import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { Button } from "@jahonbozor/ui";

import type { AdminProductItem } from "@jahonbozor/schemas/src/products";
import type { HistoryEntryItem } from "@jahonbozor/schemas/src/products/product-history.dto";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export interface IncomeActions {
    onDelete?: (id: number) => void;
}

export function getIncomeColumns(
    t: TFunction,
    products: AdminProductItem[],
    actions?: IncomeActions,
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
            cell: ({ getValue }) => {
                const raw = getValue<string | null>();
                if (!raw) return "";
                // Localize system-generated reasons (order:123, order_update:123, etc.)
                const match = /^(order|order_update|order_delete|order_restore):(\d+)$/.exec(raw);
                if (match) return t(`reason_${match[1]}`, { id: match[2] });
                return raw;
            },
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
        ...(actions?.onDelete
            ? [
                  {
                      id: "actions",
                      header: "",
                      size: 50,
                      meta: { align: "center" as const },
                      cell: ({ row }: { row: { original: HistoryEntryItem } }) => (
                          <div className="inline-flex w-full justify-center transition-transform active:scale-90">
                              <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                                  onClick={() => actions.onDelete!(row.original.id)}
                                  title={t("common:delete")}
                              >
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      ),
                  } as ColumnDef<HistoryEntryItem, unknown>,
              ]
            : []),
    ];
}
