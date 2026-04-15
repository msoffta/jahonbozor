import * as React from "react";
import { NumericFormat } from "react-number-format";

import { cn } from "../../lib/utils";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DataTableCombobox } from "./data-table-combobox";

import type { DataTableColumnMeta } from "./types";

/** Ghost input class — borderless, minimal height, no ring */
export const GHOST_INPUT_CLASS =
    "ghost-input h-6 px-0 text-sm rounded-none focus-visible:ring-0 focus:outline-none";

/** Safely convert unknown cell value to display string */
export function toDisplayString(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}

export interface DataTableCellInputProps {
    meta: DataTableColumnMeta;
    value: unknown;
    error?: string | null;

    /** Called when value changes (typing, selection). Caller controls save semantics. */
    onChange: (newValue: unknown) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;

    /** Blur callback — editable cell uses for auto-save; new row typically omits */
    onBlur?: () => void;
    /** DatePicker close callback — editable cell saves on close */
    onClose?: () => void;
    /** Combobox/select immediate-save callback (option selected from dropdown) */
    onSelect?: (value: string) => void;

    inputRef?: (el: HTMLInputElement | null) => void;
    className?: string;
    placeholder?: string;
    /** Display label override for combobox when the value is not in selectOptions */
    labelOverride?: string;
}

/**
 * Stateless input renderer shared between DataTableEditableCell and inline new rows.
 * Renders the appropriate input component based on `meta.inputType`.
 * Does NOT render error tooltips — caller handles error display.
 */
export const DataTableCellInput = React.memo(function DataTableCellInput({
    meta,
    value,
    error,
    onChange,
    onKeyDown,
    onBlur,
    onClose,
    onSelect,
    inputRef,
    className,
    placeholder,
    labelOverride,
}: DataTableCellInputProps) {
    const ghost = className ?? GHOST_INPUT_CLASS;
    const resolvedPlaceholder = placeholder ?? meta.placeholder;

    if (meta.inputType === "select" && meta.selectOptions) {
        return (
            <Select
                value={toDisplayString(value)}
                onValueChange={(newValue) => {
                    onChange(newValue);
                    onSelect?.(newValue);
                }}
            >
                <SelectTrigger className={cn(ghost, error && "border-destructive")}>
                    <SelectValue placeholder={resolvedPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                    {meta.selectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (meta.inputType === "combobox" && meta.selectOptions) {
        return (
            <DataTableCombobox
                value={toDisplayString(value)}
                options={meta.selectOptions}
                onChange={(newValue) => onChange(newValue)}
                onSelect={onSelect}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                inputRef={inputRef}
                placeholder={resolvedPlaceholder}
                error={!!error}
                onSearch={meta.onSearchOptions}
                className={ghost}
                labelOverride={labelOverride}
            />
        );
    }

    if (meta.inputType === "datepicker") {
        return (
            <DatePicker
                value={value as Date | string | undefined}
                showTime={meta.showTime}
                onChange={(date) => {
                    const val = date
                        ? meta.showTime
                            ? date.toISOString()
                            : date.toISOString().split("T")[0]
                        : "";
                    onChange(val);
                }}
                onClose={onClose}
                onKeyDown={onKeyDown}
                inputRef={inputRef}
                placeholder={resolvedPlaceholder}
                className={cn(ghost, "w-full", error && "border-destructive")}
            />
        );
    }

    if (meta.inputType === "currency") {
        return (
            <NumericFormat
                getInputRef={(el: HTMLInputElement) => inputRef?.(el)}
                customInput={Input}
                value={value != null ? Number(value) : ""}
                thousandSeparator=" "
                decimalScale={0}
                allowNegative={false}
                onValueChange={(vals) => onChange(vals.floatValue ?? 0)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                placeholder={resolvedPlaceholder}
                className={cn(ghost, error && "border-destructive")}
            />
        );
    }

    // Default: text / number / date input
    const isNumber = meta.inputType === "number";
    return (
        <Input
            ref={(el) => inputRef?.(el)}
            type={meta.inputType === "date" ? "date" : "text"}
            inputMode={isNumber ? "numeric" : undefined}
            value={toDisplayString(value)}
            onChange={(e) => {
                if (isNumber) {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    onChange(raw === "" ? "" : Number(raw));
                } else {
                    onChange(e.target.value);
                }
            }}
            onKeyDown={(e) => {
                // Block non-numeric keys in number inputs
                if (
                    isNumber &&
                    e.key.length === 1 &&
                    !/\d/.test(e.key) &&
                    !e.ctrlKey &&
                    !e.metaKey
                ) {
                    e.preventDefault();
                    return;
                }
                onKeyDown?.(e);
            }}
            onBlur={onBlur}
            placeholder={resolvedPlaceholder}
            className={cn(ghost, error && "border-destructive")}
        />
    );
});
