import * as React from "react";

import { flexRender } from "@tanstack/react-table";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { DataTableCellInput, GHOST_INPUT_CLASS, toDisplayString } from "./data-table-cell-input";

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

    const rawValue = cell.getValue();
    const editValue = meta?.editValueAccessor
        ? meta.editValueAccessor(cell.row.original)
        : rawValue;
    const [value, setValue] = React.useState(editValue);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const cancellingRef = React.useRef(false);

    React.useEffect(() => {
        setValue(meta?.editValueAccessor ? meta.editValueAccessor(cell.row.original) : rawValue);
    }, [rawValue, meta, cell.row.original]);

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
            />
            {error && (
                <motion.p
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="text-destructive absolute -bottom-5 left-0 text-xs"
                >
                    {error}
                </motion.p>
            )}
        </div>
    );
}
