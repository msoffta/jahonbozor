import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { TableCell } from "../ui/table";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface DataTableNewRowProps<TData> {
    columns: ColumnDef<TData, any>[];
    onSave: (data: Record<string, unknown>) => void;
    defaultValues?: Partial<TData>;
    enableRowSelection?: boolean;
}

export function DataTableNewRow<TData>({
    columns,
    onSave,
    defaultValues,
    enableRowSelection,
}: DataTableNewRowProps<TData>) {
    const [values, setValues] = React.useState<Record<string, unknown>>(() => {
        const initial: Record<string, unknown> = {};
        for (const col of columns) {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (key) {
                initial[key] = (defaultValues as Record<string, unknown>)?.[key] ?? "";
            }
        }
        return initial;
    });

    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

    const editableColumns = columns.filter((col) => col.meta?.editable);

    const handleSave = () => {
        const newErrors: Record<string, string> = {};
        let hasError = false;

        for (const col of editableColumns) {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (!key) continue;

            const meta = col.meta;
            if (meta?.validationSchema) {
                const result = meta.validationSchema.safeParse(values[key]);
                if (!result.success) {
                    newErrors[key] = result.error.issues[0]?.message ?? "Invalid";
                    hasError = true;
                }
            }
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        onSave(values);

        // Reset values
        const reset: Record<string, unknown> = {};
        for (const col of columns) {
            const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
            if (key) {
                reset[key] = (defaultValues as Record<string, unknown>)?.[key] ?? "";
            }
        }
        setValues(reset);
    };

    const handleKeyDown = (e: React.KeyboardEvent, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // If last editable column, save
            if (colIndex === editableColumns.length - 1) {
                handleSave();
            } else {
                // Focus next input
                const nextCol = editableColumns[colIndex + 1];
                const nextKey = nextCol && ("accessorKey" in nextCol ? String(nextCol.accessorKey) : nextCol.id);
                if (nextKey) {
                    inputRefs.current.get(nextKey)?.focus();
                }
            }
        } else if (e.key === "Tab" && !e.shiftKey && colIndex === editableColumns.length - 1) {
            e.preventDefault();
            handleSave();
        }
    };

    let editableIndex = 0;

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="border-b border-dashed bg-muted/30"
        >
            {enableRowSelection && <TableCell />}
            {columns.map((col) => {
                const key = "accessorKey" in col ? String(col.accessorKey) : col.id;
                if (!key) return <TableCell key={String(col.id ?? Math.random())} />;

                const meta = col.meta;
                if (!meta?.editable) {
                    return <TableCell key={key} className="text-muted-foreground text-sm italic">—</TableCell>;
                }

                const currentEditableIndex = editableIndex++;
                const error = errors[key];

                return (
                    <TableCell key={key} className="relative p-2">
                        {meta.inputType === "select" && meta.selectOptions ? (
                            <Select
                                value={String(values[key] ?? "")}
                                onValueChange={(newValue) => {
                                    setValues((prev) => ({ ...prev, [key]: newValue }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                            >
                                <SelectTrigger className={cn("h-8 text-sm", error && "border-destructive")}>
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
                        ) : (
                            <Input
                                ref={(el) => {
                                    if (el) inputRefs.current.set(key, el);
                                }}
                                type={meta.inputType === "number" ? "number" : meta.inputType === "date" ? "date" : "text"}
                                value={String(values[key] ?? "")}
                                onChange={(e) => {
                                    const newValue = meta.inputType === "number" ? Number(e.target.value) : e.target.value;
                                    setValues((prev) => ({ ...prev, [key]: newValue }));
                                    setErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                    });
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentEditableIndex)}
                                placeholder={meta.placeholder}
                                className={cn("h-8 text-sm", error && "border-destructive")}
                            />
                        )}
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, x: 0 }}
                                animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
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
