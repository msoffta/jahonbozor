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
    const [isEditing, setIsEditing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (!isEditing) {
            setValue(
                meta?.editValueAccessor ? meta.editValueAccessor(cell.row.original) : rawValue,
            );
        }
    }, [rawValue, isEditing, meta, cell.row.original]);

    const handleSave = React.useCallback(
        (currentValue: unknown = value, closeEdit = true) => {
            if (meta?.validationSchema) {
                const result = meta.validationSchema.safeParse(currentValue);
                if (!result.success) {
                    setError(result.error.issues[0]?.message ?? "Invalid value");
                    return;
                }
            }
            setError(null);
            if (closeEdit) {
                setIsEditing(false);
            }

            if (currentValue !== editValue) {
                // Skip internal updateData when onCellEdit handles external state
                // (avoids corrupting complex objects like product: {id, name, ...})
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

    // Auto-save effect
    React.useEffect(() => {
        if (!isEditing || value === editValue) return;

        const timer = setTimeout(() => {
            handleSave(value, false);
        }, AUTO_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [value, isEditing, editValue, handleSave]);

    const handleCancel = () => {
        setValue(editValue);
        setError(null);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave(value, true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

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
                {toDisplayString(rawValue)}
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="relative">
                {meta?.inputType === "select" && meta.selectOptions ? (
                    <Select
                        value={toDisplayString(value)}
                        onValueChange={(newValue) => {
                            setValue(newValue);
                            setError(null);
                            setIsEditing(false);
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
                        <SelectTrigger className="h-8 text-sm">
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
                            setIsEditing(false);
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
                        autoFocus
                        onBlur={() => {
                            setIsEditing(false);
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
                            if (e.key === "Enter") {
                                e.preventDefault();
                                setIsEditing(false);
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
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                handleCancel();
                            }
                        }}
                        placeholder={meta.placeholder}
                        error={!!error}
                        onSearch={meta?.onSearchOptions}
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
                            (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
                                el;
                        }}
                        placeholder={meta?.placeholder}
                        className="h-8 w-full text-sm"
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
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={cn("h-8 text-sm", error && "border-destructive")}
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
                                meta?.inputType === "number"
                                    ? Number(e.target.value)
                                    : e.target.value;
                            setValue(newValue);
                            setError(null);
                        }}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={cn("h-8 text-sm", error && "border-destructive")}
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

    return (
        <div
            onDoubleClick={() => setIsEditing(true)}
            className={cn(
                "cursor-text truncate",
                meta?.align === "center" && "text-center",
                meta?.align === "right" && "text-right",
                meta?.className,
            )}
        >
            {cell.column.columnDef.cell
                ? flexRender(cell.column.columnDef.cell, cell)
                : toDisplayString(rawValue)}
        </div>
    );
}
