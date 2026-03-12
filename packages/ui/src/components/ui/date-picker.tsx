import * as React from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "./popover";
import { Calendar } from "./calendar";

dayjs.extend(customParseFormat);

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
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const innerRef = React.useRef<HTMLInputElement>(null);

    const displayFormat = showTime ? "DD.MM.YYYY HH:mm" : "DD.MM.YYYY";

    // Local text state — synced from value, allows free typing
    const [inputText, setInputText] = React.useState(() => {
        if (!value) return "";
        const parsed = dayjs(value);
        return parsed.isValid() ? parsed.format(displayFormat) : "";
    });

    // Sync inputText when value changes externally (calendar click, parent update)
    React.useEffect(() => {
        if (value) {
            const parsed = dayjs(value);
            if (parsed.isValid()) {
                setInputText(parsed.format(displayFormat));
            }
        } else {
            setInputText("");
        }
    }, [value, displayFormat]);

    const dateValue = React.useMemo(() => {
        if (!value) return undefined;
        const parsed = dayjs(value);
        return parsed.isValid() ? parsed.toDate() : undefined;
    }, [value]);

    const time = React.useMemo(() => {
        if (!dateValue) return "00:00";
        return dayjs(dateValue).format("HH:mm");
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
                const parsed = dayjs(value);
                if (parsed.isValid()) setInputText(parsed.format(displayFormat));
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

        const parsed = dayjs(text, displayFormat, true);
        if (parsed.isValid()) {
            onChange(parsed.toDate());
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
        // Resync input text from value on blur (fixes invalid intermediate text)
        if (value) {
            const parsed = dayjs(value);
            if (parsed.isValid()) setInputText(parsed.format(displayFormat));
        } else {
            setInputText("");
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            const current = dayjs(value || new Date());
            if (current.isValid()) {
                e.preventDefault();
                const next =
                    e.key === "ArrowUp"
                        ? current.add(1, "day")
                        : current.subtract(1, "day");
                onChange(next.toDate());
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
                <div className="relative">
                    <Input
                        ref={setRef}
                        value={inputText}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleInputKeyDown}
                        placeholder={placeholder ?? displayFormat}
                        disabled={disabled}
                        className={cn("pr-8", className)}
                    />
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={disabled}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                        >
                            <CalendarIcon className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                </div>
            </PopoverAnchor>
            <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={handleSelect}
                    defaultMonth={dateValue}
                />
                {showTime && (
                    <div className="border-t p-3 flex items-center gap-2">
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
                            OK
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
DatePicker.displayName = "DatePicker";

export { DatePicker };
