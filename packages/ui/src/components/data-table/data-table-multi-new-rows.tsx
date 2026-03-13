import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import type { NewRowState } from "./types";
import { DataTableNewRow } from "./data-table-new-row";

interface DataTableMultiNewRowsProps<TData> {
    columns: ColumnDef<TData, any>[];
    rowStates: NewRowState[];
    onRowChange: (rowId: string, values: Record<string, unknown>) => void;
    onRowSave: (rowId: string) => void;
    onRowDelete?: (rowId: string) => void;
    onRowFocus?: (rowId: string) => void;
    onRowBlur?: (rowId: string) => void;
    onRowFocusNext?: (rowId: string) => void;
    enableRowSelection?: boolean;
    defaultValuesFactory: (rowIndex: number) => Partial<TData>;
    onNeedMoreRows: () => void;
}

export function DataTableMultiNewRows<TData>({
    columns,
    rowStates,
    onRowChange,
    onRowSave,
    onRowDelete: _onRowDelete,
    onRowFocus,
    onRowBlur,
    onRowFocusNext,
    enableRowSelection,
    defaultValuesFactory,
    onNeedMoreRows,
}: DataTableMultiNewRowsProps<TData>) {
    const sentinelRef = React.useRef<HTMLTableRowElement>(null);

    // IntersectionObserver для lazy loading новых строк
    React.useEffect(() => {
        if (!onNeedMoreRows) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onNeedMoreRows();
                }
            },
            { rootMargin: "200px" }, // Trigger before reaching bottom
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [onNeedMoreRows]);

    return (
        <>
            {rowStates.map((rowState, index) => (
                <DataTableNewRow
                    key={rowState.id}
                    id={rowState.id}
                    columns={columns}
                    defaultValues={defaultValuesFactory(index)}
                    onSave={() => onRowSave(rowState.id)}
                    onChange={(values) => onRowChange(rowState.id, values)}
                    onFocus={() => onRowFocus?.(rowState.id)}
                    onBlur={() => onRowBlur?.(rowState.id)}
                    onFocusNextRow={() => onRowFocusNext?.(rowState.id)}
                    enableRowSelection={enableRowSelection}
                    externalValues={rowState.values}
                    externalErrors={rowState.errors}
                />
            ))}

            {/* Sentinel элемент для IntersectionObserver */}
            <tr
                ref={sentinelRef}
                style={{ height: 1, visibility: "hidden" }}
                aria-hidden="true"
            >
                <td />
            </tr>
        </>
    );
}
