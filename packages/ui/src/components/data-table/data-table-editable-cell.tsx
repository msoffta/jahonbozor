import * as React from "react";

import { flexRender } from "@tanstack/react-table";

import { cn } from "../../lib/utils";
import { DataTableCellInput, GHOST_INPUT_CLASS, toDisplayString } from "./data-table-cell-input";
import { DataTableScrollingContext } from "./use-is-scrolling";

import type { CellContext } from "@tanstack/react-table";

interface DataTableEditableCellProps<TData> {
    cell: CellContext<TData, unknown>;
    enableEditing?: boolean;
    onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
}

export function DataTableEditableCell<TData>({
    cell,
    enableEditing,
    onCellEdit,
}: DataTableEditableCellProps<TData>) {
    const meta = cell.column.columnDef.meta;
    const isEditable = enableEditing && meta?.editable;
    const isScrolling = React.use(DataTableScrollingContext);

    // If the cell mounts WHILE scrolling, defer the heavy input mount until
    // scrolling idles — this keeps virtualizer remounts cheap (display div
    // only). Cells that mount when not scrolling stay as full inputs and are
    // NOT swapped when a later scroll starts, so no unmount-storm mid-scroll.
    const [deferInput, setDeferInput] = React.useState(() => isScrolling);
    React.useEffect(() => {
        if (deferInput && !isScrolling) setDeferInput(false);
    }, [deferInput, isScrolling]);

    const rawValue = cell.getValue();
    const editValue = meta?.editValueAccessor
        ? meta.editValueAccessor(cell.row.original)
        : rawValue;
    const [value, setValue] = React.useState(editValue);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const cancellingRef = React.useRef(false);
    const prevEditValueRef = React.useRef(editValue);

    // Sync from external data only when the actual value changes (not on every render)
    React.useEffect(() => {
        if (prevEditValueRef.current !== editValue) {
            prevEditValueRef.current = editValue;
            setValue(editValue);
        }
    }, [editValue]);

    const handleSave = React.useCallback(
        (currentValue: unknown = value) => {
            if (meta?.validationSchema) {
                const result = meta.validationSchema.safeParse(currentValue);
                if (!result.success) {
                    setError(result.error.issues[0]?.message ?? "Invalid value");
                    return;
                }
            }
            setError(null);

            if (currentValue !== editValue) {
                if (!onCellEdit) {
                    cell.table.options.meta?.updateData(
                        cell.row.index,
                        cell.column.id,
                        currentValue,
                    );
                }
                onCellEdit?.(cell.row.index, cell.column.id, currentValue);
            }
        },
        [value, editValue, meta, cell, onCellEdit],
    );

    const handleCancel = () => {
        cancellingRef.current = true;
        setValue(editValue);
        setError(null);
        inputRef.current?.blur();
        requestAnimationFrame(() => {
            cancellingRef.current = false;
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Enter navigation handled by use-cell-navigation.ts (capture phase).
        // Blur triggered by that handler already calls handleSave via onBlur.
        if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

    // Non-editable cell — plain text
    if (!isEditable) {
        const align = meta?.align ?? "left";
        return (
            <div
                className={cn(
                    "truncate",
                    align === "center" && "text-center",
                    align === "right" && "text-right",
                    meta?.className,
                )}
            >
                {cell.column.columnDef.cell
                    ? flexRender(cell.column.columnDef.cell, cell)
                    : toDisplayString(rawValue)}
            </div>
        );
    }

    // Lightweight display only while the cell was brought in by the
    // virtualizer during an active scroll. Already-mounted cells don't swap
    // (no mid-scroll unmount storm); new cells upgrade to the full input on
    // the next scroll-idle tick via the effect above.
    if (deferInput) {
        const displayNode = cell.column.columnDef.cell
            ? flexRender(cell.column.columnDef.cell, cell)
            : toDisplayString(value);
        const labelOverride = meta?.resolveLabel?.(cell.row.original);
        return (
            <div
                className={cn(
                    "flex h-6 items-center truncate text-sm",
                    meta?.align === "right" && "justify-end text-right",
                    meta?.align === "center" && "justify-center text-center",
                    meta?.className,
                )}
            >
                {labelOverride ?? displayNode}
            </div>
        );
    }

    // Editable cell — always-visible ghost input via DataTableCellInput
    return (
        <div className="relative">
            <DataTableCellInput
                meta={meta}
                value={value}
                error={error}
                onChange={(newValue) => {
                    setValue(newValue);
                    setError(null);
                }}
                onKeyDown={(e) => {
                    // Combobox only sends Escape; other inputs get full handleKeyDown
                    if (meta?.inputType === "combobox") {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancel();
                        }
                    } else {
                        handleKeyDown(e);
                    }
                }}
                onBlur={() => {
                    if (!cancellingRef.current) handleSave();
                }}
                onClose={() => handleSave()}
                onSelect={(newValue) => {
                    // Immediate save for select/combobox
                    if (newValue !== toDisplayString(editValue)) {
                        if (!onCellEdit) {
                            cell.table.options.meta?.updateData(
                                cell.row.index,
                                cell.column.id,
                                newValue,
                            );
                        }
                        onCellEdit?.(cell.row.index, cell.column.id, newValue);
                    }
                }}
                inputRef={(el) => {
                    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                }}
                className={GHOST_INPUT_CLASS}
                labelOverride={meta?.resolveLabel?.(cell.row.original)}
            />
            {error && <p className="text-destructive absolute -bottom-5 left-0 text-xs">{error}</p>}
        </div>
    );
}
