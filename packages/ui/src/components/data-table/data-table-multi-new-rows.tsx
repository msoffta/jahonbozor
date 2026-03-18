import * as React from "react";

import { DataTableNewRow } from "./data-table-new-row";

import type { NewRowState } from "./types";
import type { ColumnDef } from "@tanstack/react-table";

interface DataTableMultiNewRowsProps<TData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any` for heterogeneous column value types
    columns: ColumnDef<TData, any>[];
    rowStates: NewRowState[];
    onRowChange: (rowId: string, values: Record<string, unknown>) => void;
    onRowSave: (rowId: string) => void;
    onRowFocus?: (rowId: string) => void;
    onRowBlur?: (rowId: string) => void;
    onRowFocusNext?: (rowId: string) => void;
    onRowSaveAndLoop?: (rowId: string) => Promise<boolean>;
    enableRowSelection?: boolean;
    defaultValuesFactory: (rowIndex: number) => Partial<TData>;
    onNeedMoreRows: () => void;
}

export function DataTableMultiNewRows<TData>({
    columns,
    rowStates,
    onRowChange,
    onRowSave,
    onRowFocus,
    onRowBlur,
    onRowFocusNext,
    onRowSaveAndLoop,
    enableRowSelection,
    defaultValuesFactory,
    onNeedMoreRows,
}: DataTableMultiNewRowsProps<TData>) {
    const sentinelRef = React.useRef<HTMLTableRowElement>(null);

    // IntersectionObserver for lazy loading new rows
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
                    onSaveAndLoop={
                        onRowSaveAndLoop ? () => onRowSaveAndLoop(rowState.id) : undefined
                    }
                    enableRowSelection={enableRowSelection}
                    externalValues={rowState.values}
                    externalErrors={rowState.errors}
                />
            ))}

            {/* Sentinel element for IntersectionObserver */}
            <tr ref={sentinelRef} style={{ height: 1, visibility: "hidden" }} aria-hidden="true">
                <td />
            </tr>
        </>
    );
}
