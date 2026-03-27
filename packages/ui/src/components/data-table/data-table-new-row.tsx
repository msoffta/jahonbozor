import * as React from "react";
import { NumericFormat } from "react-number-format";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/checkbox";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { TableCell } from "../ui/table";
import { DataTableCombobox } from "./data-table-combobox";

import type { ColumnDef } from "@tanstack/react-table";

/** Safely convert unknown cell value to display string */
function toDisplayString(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}

interface DataTableNewRowProps<TData> {
    id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any` for heterogeneous column value types
    columns: ColumnDef<TData, any>[];
    onSave: (data: Record<string, unknown>) => void;
    defaultValues?: Partial<TData>;
    enableRowSelection?: boolean;
    onChange?: (values: Record<string, unknown>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusNextRow?: () => void;
    onSaveAndLoop?: () => Promise<boolean>;
    externalValues?: Record<string, unknown>;
    externalErrors?: Record<string, string>;
    isSaving?: boolean;
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
    onSaveAndLoop,
    externalValues,
    externalErrors,
    isSaving,
}: DataTableNewRowProps<TData>) {
    // Determine if controlled mode
    const isControlled = externalValues !== undefined;

    const [internalValues, setInternalValues] = React.useState<Record<string, unknown>>(() => {
        const initial: Record<string, unknown> = {};
        for (const col of columns) {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (key) {
                initial[key] = (defaultValues as Record<string, unknown>)?.[key] ?? "";
            }
        }
        return initial;
    });

    const [internalErrors, setInternalErrors] = React.useState<Record<string, string>>({});

    // Use external state if controlled, otherwise internal
    const values = isControlled ? externalValues : internalValues;
    const errors = isControlled ? (externalErrors ?? {}) : internalErrors;
    const setValues = isControlled
        ? (
              newValues:
                  | Record<string, unknown>
                  | ((prev: Record<string, unknown>) => Record<string, unknown>),
          ) => {
              const resolved =
                  typeof newValues === "function" ? newValues(externalValues) : newValues;
              onChange?.(resolved);
          }
        : setInternalValues;
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op when controlled (parent manages errors)
    const setErrors = isControlled ? () => {} : setInternalErrors;
    const clearError = (key: string) =>
        setErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

    // Update internal state when defaultValues change from outside (uncontrolled mode only)
    React.useEffect(() => {
        if (isControlled || !defaultValues) return;
        setInternalValues((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const col of columns) {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
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
                    const result = meta.validationSchema.safeParse(currentValues[key]);
                    if (!result.success) {
                        newErrors[key] = result.error.issues[0]?.message ?? "Invalid";
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

    const focusFirstEditable = () => {
        const firstCol = editableColumns[0];
        const firstKey =
            firstCol && ("accessorKey" in firstCol ? String(firstCol.accessorKey) : firstCol.id);
        const firstInput = firstKey ? inputRefs.current.get(firstKey) : null;
        firstInput?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (colIndex === editableColumns.length - 1) {
                if (onSaveAndLoop) {
                    void onSaveAndLoop().then((saved) => {
                        if (saved) {
                            focusFirstEditable();
                        } else {
                            onFocusNextRow?.();
                        }
                    });
                } else {
                    handleSave();
                    onFocusNextRow?.();
                }
            } else {
                // Try to focus next editable input; if no ref registered, save
                const nextCol = editableColumns[colIndex + 1];
                const nextKey =
                    nextCol &&
                    ("accessorKey" in nextCol ? String(nextCol.accessorKey) : nextCol.id);
                const nextInput = nextKey ? inputRefs.current.get(nextKey) : null;
                if (nextInput) {
                    nextInput.focus();
                } else {
                    handleSave();
                }
            }
        } else if (e.key === "Tab" && !e.shiftKey && colIndex === editableColumns.length - 1) {
            e.preventDefault();
            if (onSaveAndLoop) {
                void onSaveAndLoop().then((saved) => {
                    if (saved) {
                        focusFirstEditable();
                    } else {
                        onFocusNextRow?.();
                    }
                });
            } else if (onFocusNextRow) {
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
            data-row-id={id}
            onFocus={onFocus}
            onBlur={(e) => {
                // Only trigger blur if focus is moving outside the row
                const target = e.relatedTarget as Node;

                // Ignore blur if relatedTarget is null (focus went to portal/dropdown)
                if (!target) return;

                // Ignore blur if focus is still within the row
                if (e.currentTarget.contains(target)) return;

                // Ignore blur if focus went to a portal element (combobox/select/datepicker dropdown)
                const targetElement = target as Element;
                if (targetElement?.closest?.("[data-radix-popper-content-wrapper]")) return;
                if (targetElement?.closest?.('[role="listbox"]')) return;
                if (targetElement?.closest?.('[role="dialog"]')) return;

                // Delay to let child inputs (combobox) commit their values first
                setTimeout(() => onBlur?.(), 200);
            }}
            initial={false}
            className="border-b"
        >
            {enableRowSelection && (
                <TableCell>
                    <Checkbox />
                </TableCell>
            )}
            {columns.map((col, colIndex) => {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) return <TableCell key={col.id ?? `empty-${colIndex}`} />;

                const meta = col.meta;
                if (!meta?.editable) {
                    const val = values[key];
                    const displayVal =
                        typeof val === "number"
                            ? val.toLocaleString()
                            : val !== undefined && val !== ""
                              ? toDisplayString(val)
                              : "";

                    return (
                        <TableCell
                            key={key}
                            className={cn(
                                "bg-muted text-sm",
                                meta?.align === "right" && "text-right",
                                meta?.align === "center" && "text-center",
                                "text-muted-foreground",
                                meta?.cellClassName,
                            )}
                        >
                            {isSaving && colIndex === 0 ? (
                                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                            ) : (
                                displayVal
                            )}
                        </TableCell>
                    );
                }

                const currentEditableIndex = editableIndex++;
                const error = errors[key];

                return (
                    <TableCell key={key} className={cn("relative", meta?.cellClassName)}>
                        {meta.inputType === "select" && meta.selectOptions ? (
                            <Select
                                value={toDisplayString(values[key])}
                                onValueChange={(newValue) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    clearError(key);
                                }}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "ghost-input h-7 rounded-none px-0 text-sm focus-visible:ring-0",
                                        error && "border-destructive",
                                    )}
                                >
                                    <SelectValue placeholder={meta.placeholder} />
                                </SelectTrigger>
                                <SelectContent>
                                    {meta.selectOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : meta.inputType === "combobox" && meta.selectOptions ? (
                            <DataTableCombobox
                                value={toDisplayString(values[key])}
                                options={meta.selectOptions}
                                onChange={(newValue) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    clearError(key);
                                }}
                                onSelect={(newValue) => {
                                    setValues({
                                        ...values,
                                        [key]: newValue,
                                    });
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentEditableIndex)}
                                inputRef={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                placeholder={meta.placeholder}
                                error={!!error}
                                onSearch={meta.onSearchOptions}
                                className="ghost-input h-7 rounded-none px-0 text-sm focus-visible:ring-0"
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
                                    clearError(key);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentEditableIndex)}
                                inputRef={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                placeholder={meta.placeholder}
                                className={cn(
                                    "ghost-input h-7 w-full text-sm",
                                    error && "border-destructive",
                                )}
                            />
                        ) : meta.inputType === "currency" ? (
                            <NumericFormat
                                getInputRef={(el: HTMLInputElement) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                customInput={Input}
                                value={values[key] != null ? Number(values[key]) : ""}
                                thousandSeparator=" "
                                decimalScale={0}
                                allowNegative={false}
                                onValueChange={(vals) => {
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: vals.floatValue ?? 0,
                                    }));
                                    clearError(key);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentEditableIndex)}
                                placeholder={meta.placeholder}
                                className={cn(
                                    "ghost-input h-7 rounded-none px-0 text-sm focus-visible:ring-0",
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
                                value={toDisplayString(values[key])}
                                onChange={(e) => {
                                    const newValue =
                                        meta.inputType === "number"
                                            ? Number(e.target.value)
                                            : e.target.value;
                                    setValues((prev) => ({
                                        ...prev,
                                        [key]: newValue,
                                    }));
                                    clearError(key);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentEditableIndex)}
                                placeholder={meta.placeholder}
                                className={cn(
                                    "ghost-input h-7 rounded-none px-0 text-sm focus-visible:ring-0",
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
                                className="text-destructive absolute -bottom-1 left-2 text-xs"
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
