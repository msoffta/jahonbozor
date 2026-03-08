import * as React from "react";
import type { CellContext } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { motion } from "motion/react";
import { NumericFormat } from "react-number-format";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DatePicker } from "../ui/date-picker";
import { DataTableCombobox } from "./data-table-combobox";

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

    const initialValue = cell.getValue();
    const [value, setValue] = React.useState(initialValue);
    const [isEditing, setIsEditing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (meta?.validationSchema) {
            const result = meta.validationSchema.safeParse(value);
            if (!result.success) {
                setError(result.error.issues[0]?.message ?? "Invalid value");
                return;
            }
        }
        setError(null);
        setIsEditing(false);
        if (value !== initialValue) {
            cell.table.options.meta?.updateData(cell.row.index, cell.column.id, value);
            onCellEdit?.(cell.row.index, cell.column.id, value);
        }
    };

    const handleCancel = () => {
        setValue(initialValue);
        setError(null);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

    if (!isEditable) {
        const align = meta?.align ?? "left";
        return (
            <div className={cn("truncate", align === "center" && "text-center", align === "right" && "text-right", meta?.className)}>
                {String(initialValue ?? "")}
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="relative">
                {meta?.inputType === "select" && meta.selectOptions ? (
                    <Select
                        value={String(value ?? "")}
                        onValueChange={(newValue) => {
                            setValue(newValue);
                            setError(null);
                            setIsEditing(false);
                            if (newValue !== String(initialValue)) {
                                cell.table.options.meta?.updateData(cell.row.index, cell.column.id, newValue);
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
                        value={String(value ?? "")}
                        options={meta.selectOptions}
                        onChange={(newValue) => {
                            setValue(newValue);
                            setError(null);
                        }}
                        onSelect={(newValue) => {
                            setIsEditing(false);
                            if (newValue !== String(initialValue)) {
                                cell.table.options.meta?.updateData(cell.row.index, cell.column.id, newValue);
                                onCellEdit?.(cell.row.index, cell.column.id, newValue);
                            }
                        }}
                        autoFocus
                        onBlur={() => {
                            setIsEditing(false);
                            const v = value;
                            if (v !== initialValue) {
                                cell.table.options.meta?.updateData(cell.row.index, cell.column.id, v);
                                onCellEdit?.(cell.row.index, cell.column.id, v);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                setIsEditing(false);
                                const v = value;
                                if (v !== initialValue) {
                                    cell.table.options.meta?.updateData(cell.row.index, cell.column.id, v);
                                    onCellEdit?.(cell.row.index, cell.column.id, v);
                                }
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                handleCancel();
                            }
                        }}
                        placeholder={meta.placeholder}
                        error={!!error}
                    />
                ) : meta?.inputType === "datepicker" ? (
                    <DatePicker
                        value={value as Date | string | undefined}
                        showTime={meta?.showTime}
                        onChange={(date) => {
                            const val = date
                                ? meta?.showTime ? date.toISOString() : date.toISOString().split("T")[0]
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
                        className="h-8 text-sm w-full"
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
                        type={meta?.inputType === "number" ? "number" : meta?.inputType === "date" ? "date" : "text"}
                        value={String(value ?? "")}
                        onChange={(e) => {
                            const newValue = meta?.inputType === "number" ? Number(e.target.value) : e.target.value;
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
                        className="absolute -bottom-5 left-0 text-xs text-destructive"
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
                "truncate cursor-text",
                meta?.align === "center" && "text-center",
                meta?.align === "right" && "text-right",
                meta?.className,
            )}
        >
            {cell.column.columnDef.cell
                ? flexRender(cell.column.columnDef.cell, cell)
                : String(initialValue ?? "")}
        </div>
    );
}
