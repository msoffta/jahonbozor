import * as React from "react";
import { NumericFormat } from "react-number-format";

import { flexRender } from "@tanstack/react-table";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DataTableCombobox } from "./data-table-combobox";

import type { CellContext } from "@tanstack/react-table";

/** Safely convert unknown cell value to display string */
function toDisplayString(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}

/** Auto-save debounce delay for editable cells */
const AUTO_SAVE_DEBOUNCE_MS = 500;

const GHOST = "ghost-input h-6 px-0 text-sm rounded-none focus-visible:ring-0";

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
    const hasMountedRef = React.useRef(false);
    const cancellingRef = React.useRef(false);

    React.useEffect(() => {
        setValue(meta?.editValueAccessor ? meta.editValueAccessor(cell.row.original) : rawValue);
    }, [rawValue, meta, cell.row.original]);

    React.useEffect(() => {
        hasMountedRef.current = true;
    }, []);

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

    // Auto-save effect — fires when value changes (not on mount)
    React.useEffect(() => {
        if (!hasMountedRef.current || value === editValue) return;

        const timer = setTimeout(() => {
            handleSave(value);
        }, AUTO_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [value, editValue, handleSave]);

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
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave(value);
            inputRef.current?.blur();
        } else if (e.key === "Escape") {
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

    // Editable cell — always-visible ghost input
    return (
        <div className="relative">
            {meta?.inputType === "select" && meta.selectOptions ? (
                <Select
                    value={toDisplayString(value)}
                    onValueChange={(newValue) => {
                        setValue(newValue);
                        setError(null);
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
                >
                    <SelectTrigger className={cn(GHOST, error && "border-destructive")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {meta.selectOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : meta?.inputType === "combobox" && meta.selectOptions ? (
                <DataTableCombobox
                    value={toDisplayString(value)}
                    options={meta.selectOptions}
                    onChange={(newValue) => {
                        setValue(newValue);
                        setError(null);
                    }}
                    onSelect={(newValue) => {
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
                    onBlur={() => {
                        if (cancellingRef.current) return;
                        const v = value;
                        if (v !== editValue) {
                            if (!onCellEdit) {
                                cell.table.options.meta?.updateData(
                                    cell.row.index,
                                    cell.column.id,
                                    v,
                                );
                            }
                            onCellEdit?.(cell.row.index, cell.column.id, v);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancel();
                        }
                    }}
                    placeholder={meta.placeholder}
                    error={!!error}
                    onSearch={meta?.onSearchOptions}
                    className={GHOST}
                />
            ) : meta?.inputType === "datepicker" ? (
                <DatePicker
                    value={value as Date | string | undefined}
                    showTime={meta?.showTime}
                    onChange={(date) => {
                        const val = date
                            ? meta?.showTime
                                ? date.toISOString()
                                : date.toISOString().split("T")[0]
                            : "";
                        setValue(val);
                        setError(null);
                    }}
                    onClose={() => {
                        handleSave();
                    }}
                    onKeyDown={handleKeyDown}
                    inputRef={(el) => {
                        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                    }}
                    placeholder={meta?.placeholder}
                    className={cn(GHOST, "w-full", error && "border-destructive")}
                />
            ) : meta?.inputType === "currency" ? (
                <NumericFormat
                    getInputRef={inputRef}
                    customInput={Input}
                    value={value != null ? Number(value) : ""}
                    thousandSeparator=" "
                    decimalScale={0}
                    allowNegative={false}
                    onValueChange={(values) => {
                        setValue(values.floatValue ?? 0);
                        setError(null);
                    }}
                    onBlur={() => !cancellingRef.current && handleSave()}
                    onKeyDown={handleKeyDown}
                    className={cn(GHOST, error && "border-destructive")}
                    placeholder={meta?.placeholder}
                />
            ) : (
                <Input
                    ref={inputRef}
                    type={
                        meta?.inputType === "number"
                            ? "number"
                            : meta?.inputType === "date"
                              ? "date"
                              : "text"
                    }
                    value={toDisplayString(value)}
                    onChange={(e) => {
                        const newValue =
                            meta?.inputType === "number" ? Number(e.target.value) : e.target.value;
                        setValue(newValue);
                        setError(null);
                    }}
                    onBlur={() => !cancellingRef.current && handleSave()}
                    onKeyDown={handleKeyDown}
                    className={cn(GHOST, error && "border-destructive")}
                    placeholder={meta?.placeholder}
                />
            )}
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
