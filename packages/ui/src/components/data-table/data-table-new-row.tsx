import type { ColumnDef } from "@tanstack/react-table";
import { motion } from "motion/react";
import * as React from "react";
import { NumericFormat } from "react-number-format";
import { cn } from "../../lib/utils";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { TableCell } from "../ui/table";
import { DataTableCombobox } from "./data-table-combobox";

interface DataTableNewRowProps<TData> {
    id?: string;
    columns: ColumnDef<TData, any>[];
    onSave: (data: Record<string, unknown>) => void;
    defaultValues?: Partial<TData>;
    enableRowSelection?: boolean;
    onChange?: (values: Record<string, unknown>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusNextRow?: () => void;
    externalValues?: Record<string, unknown>;
    externalErrors?: Record<string, string>;
}

export function DataTableNewRow<TData>({
    id = "new-row",
    columns,
    onSave,
    defaultValues,
    enableRowSelection,
    onChange,
    onFocus,
    onBlur,
    onFocusNextRow,
    externalValues,
    externalErrors,
}: DataTableNewRowProps<TData>) {
    // Determine if controlled mode
    const isControlled = externalValues !== undefined;

    const [internalValues, setInternalValues] = React.useState<Record<string, unknown>>(() => {
        const initial: Record<string, unknown> = {};
        for (const col of columns) {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (key) {
                initial[key] =
                    (defaultValues as Record<string, unknown>)?.[key] ?? "";
            }
        }
        return initial;
    });

    const [internalErrors, setInternalErrors] = React.useState<Record<string, string>>({});

    // Use external state if controlled, otherwise internal
    const values = isControlled ? externalValues : internalValues;
    const errors = isControlled ? (externalErrors ?? {}) : internalErrors;
    const setValues = isControlled
        ? (newValues: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
              const resolved = typeof newValues === 'function' ? newValues(externalValues) : newValues;
              onChange?.(resolved);
          }
        : setInternalValues;
    const setErrors = isControlled ? () => {} : setInternalErrors;
    const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

    // Update internal state when defaultValues change from outside (uncontrolled mode only)
    React.useEffect(() => {
        if (isControlled || !defaultValues) return;
        setInternalValues((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const col of columns) {
                const key =
                    "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) continue;
                const dv = (defaultValues as Record<string, unknown>)[key];
                if (dv !== undefined && dv !== next[key]) {
                    next[key] = dv;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [isControlled, defaultValues, columns]);

    // Notify parent on change (uncontrolled mode only - controlled calls onChange directly)
    React.useEffect(() => {
        if (isControlled) return;
        onChange?.(internalValues);
    }, [isControlled, internalValues, onChange]);

    const editableColumns = columns.filter((col) => col.meta?.editable);

    const handleSave = (currentValues: Record<string, unknown> = values) => {
        // In controlled mode, validation and error handling is managed by parent
        // In uncontrolled mode, we validate here
        if (!isControlled) {
            const newErrors: Record<string, string> = {};
            let hasError = false;

            for (const col of editableColumns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) continue;

                const meta = col.meta;
                if (meta?.validationSchema) {
                    const result = meta.validationSchema.safeParse(
                        currentValues[key],
                    );
                    if (!result.success) {
                        newErrors[key] =
                            result.error.issues[0]?.message ?? "Invalid";
                        hasError = true;
                    }
                }
            }

            if (hasError) {
                setInternalErrors(newErrors);
                return;
            }

            setInternalErrors({});
        }

        onSave(currentValues);

        // Reset values only in uncontrolled mode
        if (!isControlled) {
            const reset: Record<string, unknown> = {};
            for (const col of columns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (key) {
                    reset[key] = "";
                }
            }
            setInternalValues(reset);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (colIndex === editableColumns.length - 1) {
                handleSave();
                onFocusNextRow?.();
            } else {
                // Try to focus next editable input; if no ref registered, save
                const nextCol = editableColumns[colIndex + 1];
                const nextKey =
                    nextCol &&
                    ("accessorKey" in nextCol
                        ? String(nextCol.accessorKey)
                        : nextCol.id);
                const nextInput = nextKey
                    ? inputRefs.current.get(nextKey)
                    : null;
                if (nextInput) {
                    nextInput.focus();
                } else {
                    handleSave();
                }
            }
        } else if (
            e.key === "Tab" &&
            !e.shiftKey &&
            colIndex === editableColumns.length - 1
        ) {
            if (onFocusNextRow) {
                e.preventDefault();
                handleSave();
                onFocusNextRow();
            }
        }
    };

    let editableIndex = 0;

    return (
        <motion.tr
            id={id}
            data-testid="new-row"
            onFocus={onFocus}
            onBlur={(e) => {
                // Only trigger blur if focus is moving outside the row
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    onBlur?.();
                }
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="border-b border-dashed bg-muted/30"
        >
            {enableRowSelection && <TableCell />}
            {columns.map((col) => {
                const key =
                    "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key)
                    return <TableCell key={String(col.id ?? Math.random())} />;

                const meta = col.meta;
                if (!meta?.editable) {
                    const val = values[key];
                    const displayVal =
                        typeof val === "number"
                            ? val.toLocaleString()
                            : val !== undefined && val !== ""
                              ? String(val)
                              : "—";

                    return (
                        <TableCell
                            key={key}
                            className={cn(
                                "text-sm",
                                meta?.align === "right" && "text-right",
                                meta?.align === "center" && "text-center",
                                displayVal === "—" &&
                                    "text-muted-foreground italic",
                                meta?.cellClassName,
                            )}
                        >
                            {displayVal}
                        </TableCell>
                    );
                }

                const currentEditableIndex = editableIndex++;
                const error = errors[key];

                return (
                    <TableCell
                        key={key}
                        className={cn("relative p-2", meta?.cellClassName)}
                    >
                        {meta.inputType === "select" && meta.selectOptions ? (
                            <Select
                                value={String(values[key] ?? "")}
                                onValueChange={(newValue) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "h-8 text-sm",
                                        error && "border-destructive",
                                    )}
                                >
                                    <SelectValue
                                        placeholder={meta.placeholder}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {meta.selectOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : meta.inputType === "combobox" &&
                          meta.selectOptions ? (
                            <DataTableCombobox
                                value={String(values[key] ?? "")}
                                options={meta.selectOptions}
                                onChange={(newValue) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                                onSelect={(newValue) => {
                                    const newValues = {
                                        ...values,
                                        [key]: newValue,
                                    };
                                    setValues(newValues);
                                    if (
                                        key === "user" &&
                                        newValue === "CREATE_NEW"
                                    ) {
                                        handleSave(newValues);
                                    }
                                }}
                                onKeyDown={(e) =>
                                    handleKeyDown(e, currentEditableIndex)
                                }
                                inputRef={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                placeholder={meta.placeholder}
                                error={!!error}
                            />
                        ) : meta.inputType === "datepicker" ? (
                            <DatePicker
                                value={values[key] as Date | string | undefined}
                                showTime={meta.showTime}
                                onChange={(date) => {
                                    const val = date
                                        ? meta.showTime
                                            ? date.toISOString()
                                            : date.toISOString().split("T")[0]
                                        : "";
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: val,
                                    }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                                onKeyDown={(e) =>
                                    handleKeyDown(e, currentEditableIndex)
                                }
                                inputRef={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                placeholder={meta.placeholder}
                                className={cn(
                                    "h-8 text-sm w-full",
                                    error && "border-destructive",
                                )}
                            />
                        ) : meta.inputType === "currency" ? (
                            <NumericFormat
                                getInputRef={(el: HTMLInputElement) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                customInput={Input}
                                value={
                                    values[key] != null
                                        ? Number(values[key])
                                        : ""
                                }
                                thousandSeparator=" "
                                decimalScale={0}
                                allowNegative={false}
                                onValueChange={(vals) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: vals.floatValue ?? 0,
                                    }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                                onKeyDown={(e) =>
                                    handleKeyDown(e, currentEditableIndex)
                                }
                                placeholder={meta.placeholder}
                                className={cn(
                                    "h-8 text-sm",
                                    error && "border-destructive",
                                )}
                            />
                        ) : (
                            <Input
                                ref={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                type={
                                    meta.inputType === "number"
                                        ? "number"
                                        : meta.inputType === "date"
                                          ? "date"
                                          : "text"
                                }
                                value={String(values[key] ?? "")}
                                onChange={(e) => {
                                    const newValue =
                                        meta.inputType === "number"
                                            ? Number(e.target.value)
                                            : e.target.value;
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                                onKeyDown={(e) =>
                                    handleKeyDown(e, currentEditableIndex)
                                }
                                placeholder={meta.placeholder}
                                className={cn(
                                    "h-8 text-sm",
                                    error && "border-destructive",
                                )}
                            />
                        )}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, x: 0 }}
                                animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 17,
                                }}
                                className="absolute -bottom-1 left-2 text-xs text-destructive"
                            >
                                {error}
                            </motion.p>
                        )}
                    </TableCell>
                );
            })}
        </motion.tr>
    );
}
