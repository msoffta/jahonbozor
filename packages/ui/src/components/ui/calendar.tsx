import * as React from "react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import type { Locale } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const CalendarLocaleContext = React.createContext<Locale | undefined>(undefined);
const CalendarLocaleProvider = CalendarLocaleContext.Provider;

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarDropdown({ options, onChange, value, "aria-label": ariaLabel }: DropdownProps) {
    const handleValueChange = (newValue: string) => {
        if (onChange) {
            const syntheticEvent = {
                target: { value: newValue },
            } as React.ChangeEvent<HTMLSelectElement>;
            onChange(syntheticEvent);
        }
    };

    return (
        <Select value={value?.toString()} onValueChange={handleValueChange}>
            <SelectTrigger className="h-7 text-sm px-2 gap-1 font-medium focus:ring-0" aria-label={ariaLabel}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options?.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()} disabled={option.disabled}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    const contextLocale = React.useContext(CalendarLocaleContext);

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            locale={props.locale ?? contextLocale}
            weekStartsOn={props.weekStartsOn ?? 1}
            captionLayout={props.captionLayout ?? "dropdown"}
            startMonth={props.startMonth ?? new Date(2020, 0)}
            endMonth={props.endMonth ?? new Date(2030, 11)}
            className={cn("p-3", className)}
            classNames={{
                months: "relative flex flex-col sm:flex-row gap-2",
                month: "flex flex-col gap-4",
                month_caption: "flex justify-center items-center w-full h-9",
                caption_label: "text-sm font-medium",
                nav: "absolute inset-x-0 top-0 flex justify-between items-center h-9 px-1 pointer-events-none z-10",
                button_previous: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 pointer-events-auto",
                ),
                button_next: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 pointer-events-auto",
                ),
                dropdowns: "flex items-center gap-1",
                month_grid: "w-full border-collapse space-y-1",
                weekdays: "flex",
                weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                week: "flex w-full mt-2",
                day: cn(
                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                    props.mode === "range"
                        ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
                        : "[&:has([aria-selected])]:rounded-md",
                ),
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                ),
                range_end: "day-range-end",
                range_start: "day-range-start",
                selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                today: "bg-accent text-accent-foreground",
                outside:
                    "day-outside text-muted-foreground aria-selected:text-muted-foreground",
                disabled: "text-muted-foreground opacity-50",
                range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                hidden: "invisible",
                ...classNames,
            }}
            modifiers={{
                weekend: { dayOfWeek: [0, 6] },
                ...props.modifiers,
            }}
            modifiersClassNames={{
                weekend: "text-red-500",
                ...props.modifiersClassNames,
            }}
            components={{
                Chevron: ({ orientation }) => {
                    const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
                    return <Icon className="h-4 w-4" />;
                },
                Dropdown: CalendarDropdown,
                ...props.components,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar, CalendarLocaleProvider };
