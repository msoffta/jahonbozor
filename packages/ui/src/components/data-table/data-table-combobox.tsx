import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";

/** Portal z-index — must sit above all table layers and modals */
const COMBOBOX_PORTAL_Z_INDEX = 99999;
/** Minimum dropdown width to prevent narrow popups */
const COMBOBOX_MIN_WIDTH_PX = 180;
/** Delay before closing blur — allows selection click to complete */
const COMBOBOX_BLUR_DELAY_MS = 150;
/** Duration for exit animation (matches combobox-out in globals.css) */
const COMBOBOX_EXIT_ANIMATION_MS = 100;

interface DataTableComboboxProps {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (value: string) => void;
    options: { label: string; value: string }[];
    placeholder?: string;
    error?: boolean;
    autoFocus?: boolean;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onBlur?: () => void;
    inputRef?: (el: HTMLInputElement | null) => void;
    /** Text to display when no options match the query */
    noResultsText?: string;
}

export function DataTableCombobox({
    value,
    onChange,
    onSelect,
    options,
    placeholder,
    error,
    autoFocus,
    onKeyDown,
    onBlur,
    inputRef: externalRef,
    noResultsText,
}: DataTableComboboxProps) {
    const listboxId = React.useId();
    const [showList, setShowList] = React.useState(false);
    const [visible, setVisible] = React.useState(false);
    const [closing, setClosing] = React.useState(false);
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const listRef = React.useRef<HTMLDivElement>(null);
    const innerRef = React.useRef<HTMLInputElement>(null);
    const selectingRef = React.useRef(false);
    const closingTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const [pos, setPos] = React.useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    // When value matches an option's value (e.g. selected ID), show the label instead
    const isSelectedOption = React.useMemo(
        () => options.some((o) => o.value === value),
        [value, options],
    );

    const filtered = React.useMemo(() => {
        if (!value || isSelectedOption) return options;
        const lower = value.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(lower));
    }, [value, options, isSelectedOption]);

    // Reset selected index when list filter changes
    React.useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    const measurePos = React.useCallback(() => {
        const el = innerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, COMBOBOX_MIN_WIDTH_PX),
        });
    }, []);

    React.useEffect(() => {
        if (autoFocus && innerRef.current) {
            innerRef.current.focus();
            innerRef.current.select();
            measurePos();
            setShowList(true);
        }
    }, [autoFocus, measurePos]);

    // Reposition dropdown on scroll/resize while visible
    React.useEffect(() => {
        if (!visible) return;
        const update = () => measurePos();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [visible, measurePos]);

    // Animate open/close: keep portal mounted during exit animation
    React.useEffect(() => {
        if (showList && pos !== null) {
            clearTimeout(closingTimerRef.current);
            setClosing(false);
            setVisible(true);
        } else if (visible && !showList) {
            setClosing(true);
            closingTimerRef.current = setTimeout(() => {
                setVisible(false);
                setClosing(false);
            }, COMBOBOX_EXIT_ANIMATION_MS);
        }
        return () => clearTimeout(closingTimerRef.current);
    }, [showList, pos, visible]);

    const setRef = React.useCallback(
        (el: HTMLInputElement | null) => {
            (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            externalRef?.(el);
        },
        [externalRef],
    );

    const handleSelect = (optionValue: string) => {
        selectingRef.current = true;
        onChange(optionValue);
        onSelect?.(optionValue);
        setShowList(false);
        setTimeout(() => {
            selectingRef.current = false;
        }, 0);
    };

    const handleFocus = () => {
        measurePos();
        setShowList(true);
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (selectingRef.current) return;
            setShowList(false);
            onBlur?.();
        }, COMBOBOX_BLUR_DELAY_MS);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setShowList(true);
            setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setShowList(true);
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter") {
            if (showList && filtered.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(filtered[selectedIndex].value);
            }
        } else if (e.key === "Escape") {
            setShowList(false);
        }
        onKeyDown?.(e);
    };

    const [searchQuery, setSearchQuery] = React.useState("");

    // Maintain query in sync with value/external reset
    React.useEffect(() => {
        if (!value) {
            setSearchQuery("");
        } else if (value && isSelectedOption) {
            const label = options.find((o) => o.value === value)?.label ?? value;
            setSearchQuery(label);
        } else {
            setSearchQuery(value);
        }
    }, [value, isSelectedOption, options]);

    return (
        <>
            <Input
                ref={setRef}
                role="combobox"
                aria-expanded={visible}
                aria-controls={visible ? listboxId : undefined}
                aria-activedescendant={
                    visible && filtered.length > 0
                        ? `${listboxId}-option-${selectedIndex}`
                        : undefined
                }
                aria-autocomplete="list"
                value={searchQuery}
                onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    onChange(q);
                    if (!showList) {
                        measurePos();
                        setShowList(true);
                    }
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn("h-8 text-sm", error && "border-destructive")}
            />
            {visible &&
                pos !== null &&
                createPortal(
                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        data-closing={closing || undefined}
                        style={{
                            position: "fixed",
                            top: pos.top,
                            left: pos.left,
                            width: pos.width,
                            zIndex: COMBOBOX_PORTAL_Z_INDEX,
                            pointerEvents: closing ? "none" : undefined,
                        }}
                        className="combobox-dropdown bg-popover text-popover-foreground max-h-48 overflow-auto rounded-md border p-1 shadow-md"
                    >
                        {filtered.length > 0 ? (
                            filtered.map((option, index) => (
                                <div
                                    key={option.value}
                                    id={`${listboxId}-option-${index}`}
                                    role="option"
                                    aria-selected={selectedIndex === index}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelect(option.value);
                                    }}
                                    className={cn(
                                        "relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none",
                                        selectedIndex === index
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/50",
                                    )}
                                >
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="text-muted-foreground px-2 py-1.5 text-sm italic">
                                {noResultsText ?? "No results"}
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
}
