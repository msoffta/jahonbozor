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
/** Debounce delay for async search */
const SEARCH_DEBOUNCE_MS = 300;

interface ComboboxOption {
    label: string;
    value: string;
    disabled?: boolean;
    disabledReason?: string;
}

interface DataTableComboboxProps {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (value: string) => void;
    options: ComboboxOption[];
    placeholder?: string;
    error?: boolean;
    autoFocus?: boolean;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onBlur?: () => void;
    inputRef?: (el: HTMLInputElement | null) => void;
    /** Text to display when no options match the query */
    noResultsText?: string;
    /** Async search — called with debounce when user types */
    onSearch?: (query: string) => Promise<ComboboxOption[]>;
    /** Extra classes for the input element (e.g. ghost-input styling) */
    className?: string;
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
    onSearch,
    className: externalClassName,
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

    // Async search results
    const [asyncOptions, setAsyncOptions] = React.useState<ComboboxOption[] | null>(null);

    // Merge static + async options for lookups (selected option label resolution)
    const allKnownOptions = React.useMemo(() => {
        if (!asyncOptions?.length) return options;
        const map = new Map(options.map((o) => [o.value, o]));
        for (const o of asyncOptions) map.set(o.value, o);
        return Array.from(map.values());
    }, [options, asyncOptions]);

    // When value matches an option's value (e.g. selected ID), show the label instead
    const isSelectedOption = React.useMemo(
        () => allKnownOptions.some((o) => o.value === value),
        [value, allKnownOptions],
    );

    const filtered = React.useMemo(() => {
        // When async search returned results, use them directly (server already filtered)
        if (onSearch && asyncOptions) return asyncOptions;
        if (!value || isSelectedOption) return options;
        const lower = value.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(lower));
    }, [value, options, asyncOptions, isSelectedOption, onSearch]);

    // Reset selected index when list filter changes
    React.useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    // Auto-scroll to keep selected option visible
    React.useEffect(() => {
        if (!visible) return;
        const option = document.getElementById(`${listboxId}-option-${selectedIndex}`);
        option?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex, visible, listboxId]);

    const [searchQuery, setSearchQuery] = React.useState("");

    // Debounced async search
    React.useEffect(() => {
        if (!onSearch) return;
        if (!searchQuery || isSelectedOption) {
            setAsyncOptions(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            void onSearch(searchQuery).then((results) => {
                if (!cancelled) setAsyncOptions(results);
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, onSearch, isSelectedOption]);

    const measurePos = React.useCallback(() => {
        const el = innerRef.current;
        if (!el) return;
        // Use the parent cell (td) width for dropdown alignment
        const cellEl = el.closest("td");
        const rect = cellEl ? cellEl.getBoundingClientRect() : el.getBoundingClientRect();
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
        // Set label immediately so sync effect doesn't flash the ID
        const label = [...(asyncOptions ?? []), ...options].find(
            (o) => o.value === optionValue,
        )?.label;
        if (label) setSearchQuery(label);
        onChange(optionValue);
        onSelect?.(optionValue);
        setShowList(false);
        setAsyncOptions(null);
        setTimeout(() => {
            selectingRef.current = false;
        }, 0);
    };

    const handleFocus = () => {
        measurePos();
        // Don't open dropdown on focus — wait for user to type or press ArrowDown
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
            setSelectedIndex((prev) => {
                for (let i = prev + 1; i < filtered.length; i++) {
                    if (!filtered[i].disabled) return i;
                }
                return prev;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setShowList(true);
            setSelectedIndex((prev) => {
                for (let i = prev - 1; i >= 0; i--) {
                    if (!filtered[i].disabled) return i;
                }
                return prev;
            });
        } else if (e.key === "Enter") {
            if (showList && filtered.length > 0 && !filtered[selectedIndex]?.disabled) {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(filtered[selectedIndex].value);
            }
        } else if (e.key === "Escape") {
            setShowList(false);
        }
        onKeyDown?.(e);
    };

    // Maintain query in sync with value/external reset
    React.useEffect(() => {
        if (!value) {
            setSearchQuery("");
        } else if (value && isSelectedOption) {
            const label = allKnownOptions.find((o) => o.value === value)?.label ?? value;
            setSearchQuery(label);
        } else {
            setSearchQuery(value);
        }
    }, [value, isSelectedOption, allKnownOptions]);

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
                className={cn("h-8 text-sm", error && "border-destructive", externalClassName)}
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
                                    aria-disabled={option.disabled ?? undefined}
                                    title={option.disabled ? option.disabledReason : undefined}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (option.disabled) return;
                                        handleSelect(option.value);
                                    }}
                                    className={cn(
                                        "relative flex items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none",
                                        option.disabled
                                            ? "text-muted-foreground cursor-not-allowed opacity-50"
                                            : "cursor-pointer",
                                        !option.disabled && selectedIndex === index
                                            ? "bg-accent text-accent-foreground"
                                            : !option.disabled && "hover:bg-accent/50",
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
