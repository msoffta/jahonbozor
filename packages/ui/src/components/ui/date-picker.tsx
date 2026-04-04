import * as React from "react";

import { addDays, format, isValid, parse, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
    value?: Date | string;
    onChange: (date: Date | undefined) => void;
    onClose?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showTime?: boolean;
    inputRef?: (el: HTMLInputElement | null) => void;
    /** Label for the confirm button in showTime mode */
    confirmLabel?: string;
}

function DatePicker({
    value,
    onChange,
    onClose,
    onKeyDown,
    placeholder,
    className,
    disabled,
    showTime,
    inputRef: externalRef,
    confirmLabel,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const innerRef = React.useRef<HTMLInputElement>(null);

    const displayFormat = showTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy";

    /** Parse value (Date | string) into a Date, or undefined if invalid */
    const toDate = (v: Date | string): Date | undefined => {
        const d = v instanceof Date ? v : new Date(v);
        return isValid(d) ? d : undefined;
    };

    // Local text state — synced from value, allows free typing
    const [inputText, setInputText] = React.useState(() => {
        if (!value) return "";
        const d = toDate(value);
        return d ? format(d, displayFormat) : "";
    });

    // Sync inputText when value changes externally (calendar click, parent update)
    React.useEffect(() => {
        if (value) {
            const d = toDate(value);
            if (d) setInputText(format(d, displayFormat));
        } else {
            setInputText("");
        }
    }, [value, displayFormat]);

    const dateValue = React.useMemo(() => {
        if (!value) return undefined;
        return toDate(value);
    }, [value]);

    const time = React.useMemo(() => {
        if (!dateValue) return "00:00";
        return format(dateValue, "HH:mm");
    }, [dateValue]);

    const combineDateTime = (date: Date, timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const combined = new Date(date);
        combined.setHours(hours ?? 0, minutes ?? 0, 0, 0);
        return combined;
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            // Resync input text from value on close (fixes invalid intermediate text)
            if (value) {
                const d = toDate(value);
                if (d) setInputText(format(d, displayFormat));
            } else {
                setInputText("");
            }
            onClose?.();
        }
    };

    const setRef = React.useCallback(
        (el: HTMLInputElement | null) => {
            (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            externalRef?.(el);
        },
        [externalRef],
    );

    // User types date manually
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let text = e.target.value;

        // Auto-formatting (mask): 12032024 -> 12.03.2024
        const digits = text.replace(/\D/g, "");
        if (digits.length > 0) {
            let formatted = digits.slice(0, 2);
            if (digits.length > 2) formatted += "." + digits.slice(2, 4);
            if (digits.length > 4) formatted += "." + digits.slice(4, 8);
            if (showTime && digits.length > 8) {
                formatted += " " + digits.slice(8, 10);
                if (digits.length > 10) formatted += ":" + digits.slice(10, 12);
            }
            text = formatted;
        }

        setInputText(text);

        if (!text) {
            onChange(undefined);
            return;
        }

        const parsed = parse(text, displayFormat, new Date());
        if (isValid(parsed)) {
            onChange(parsed);
        }
    };

    // Calendar date selection
    const handleSelect = (date: Date | undefined) => {
        if (!date) {
            onChange(undefined);
            return;
        }

        if (showTime && dateValue) {
            // Preserve existing time when selecting a new date
            date.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
        }

        onChange(date);
        if (!showTime) {
            setOpen(false);
            innerRef.current?.focus();
        }
    };

    // Time change (showTime mode)
    const handleTimeChange = (newTime: string) => {
        if (dateValue) {
            onChange(combineDateTime(dateValue, newTime));
        }
    };

    const handleFocus = () => {
        setOpen(true);
    };

    const handleBlur = () => {
        // Don't resync while popover is open (focus may move to calendar/time)
        if (open) return;

        // Resync input text from value on blur (fixes invalid intermediate text)
        if (value) {
            const d = toDate(value);
            if (d) setInputText(format(d, displayFormat));
        } else {
            setInputText("");
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            const current = value ? toDate(value) : new Date();
            if (current && isValid(current)) {
                e.preventDefault();
                const next = e.key === "ArrowUp" ? addDays(current, 1) : subDays(current, 1);
                onChange(next);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        } else if (e.key === "Enter" && open) {
            setOpen(false);
        }
        onKeyDown?.(e);
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverAnchor asChild>
                <div className={cn("relative", className)}>
                    <Input
                        ref={setRef}
                        value={inputText}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleInputKeyDown}
                        placeholder={placeholder ?? displayFormat}
                        disabled={disabled}
                        className="pr-8"
                    />
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled}
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                            tabIndex={-1}
                        >
                            <CalendarIcon className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-auto p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                    // Don't close if interacting with the input
                    if (innerRef.current?.contains(e.target as Node)) {
                        e.preventDefault();
                    }
                }}
            >
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={handleSelect}
                    defaultMonth={dateValue}
                />
                {showTime && (
                    <div className="flex items-center gap-2 border-t p-3">
                        <Input
                            type="time"
                            value={time}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="h-8 w-auto text-sm"
                        />
                        <Button
                            size="sm"
                            variant="default"
                            className="ml-auto h-8"
                            onClick={() => setOpen(false)}
                        >
                            {confirmLabel ?? "OK"}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
DatePicker.displayName = "DatePicker";

export { DatePicker };
