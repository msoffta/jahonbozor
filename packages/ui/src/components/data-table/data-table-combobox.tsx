import * as React from "react";
import { createPortal } from "react-dom";

import { useVirtualizer } from "@tanstack/react-virtual";

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
/** Above this many filtered options, render via virtualization */
const VIRTUALIZE_THRESHOLD = 50;
/** Estimated height of a single dropdown option (matches py-1.5 + text-sm line-height) */
const OPTION_HEIGHT_PX = 32;
/** Number of off-screen options to render around the visible viewport */
const VIRTUAL_OVERSCAN = 5;

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
    /**
     * Called once after the selection has been committed and React has flushed
     * the resulting state updates. Use this to advance focus to the next cell
     * without relying on the global `combobox-select` CustomEvent listener.
     */
    onAfterSelect?: (value: string) => void;
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
    /** Fallback display label when `value` is not found in `options` or async results */
    labelOverride?: string;
}

export function DataTableCombobox({
    value,
    onChange,
    onSelect,
    onAfterSelect,
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
    labelOverride,
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

    // Cache of recently selected options — survives asyncOptions clearing so the
    // label resolves even after the dropdown is dismissed.
    const [selectedCache, setSelectedCache] = React.useState<ComboboxOption[]>([]);

    // Track whether the user is actively typing (search mode vs display mode).
    // Prevents treating numeric search text as a selected option value
    // (e.g. typing "123" should not match product ID 123).
    const [isTyping, setIsTyping] = React.useState(false);
    const isTypingRef = React.useRef(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const searchQueryRef = React.useRef("");

    // Merge static + async + selection cache for lookups (selected option label resolution)
    const allKnownOptions = React.useMemo(() => {
        if (!asyncOptions?.length && !selectedCache.length) return options;
        const map = new Map(options.map((option) => [option.value, option]));
        if (asyncOptions) {
            for (const option of asyncOptions) map.set(option.value, option);
        }
        for (const option of selectedCache) {
            if (!map.has(option.value)) map.set(option.value, option);
        }
        return Array.from(map.values());
    }, [options, asyncOptions, selectedCache]);

    // When value matches an option's value (e.g. selected ID), show the label instead.
    // Guarded by isTyping to prevent treating search text as a selection.
    const isSelectedOption = React.useMemo(
        () => !isTyping && allKnownOptions.some((o) => o.value === value),
        [value, allKnownOptions, isTyping],
    );

    const filtered = React.useMemo(() => {
        // When async search returned results, use them directly (server already filtered)
        if (onSearch && asyncOptions) return asyncOptions;
        if (!searchQuery || (isSelectedOption && !isTyping)) return options;
        const lower = searchQuery.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(lower));
    }, [searchQuery, options, asyncOptions, isSelectedOption, isTyping, onSearch]);

    // Reset selected index when list filter changes
    React.useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    const shouldVirtualize = filtered.length > VIRTUALIZE_THRESHOLD;
    const dropdownScrollRef = React.useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: shouldVirtualize ? filtered.length : 0,
        getScrollElement: () => dropdownScrollRef.current,
        estimateSize: () => OPTION_HEIGHT_PX,
        overscan: VIRTUAL_OVERSCAN,
        enabled: shouldVirtualize && visible,
    });

    // Auto-scroll to keep selected option visible
    React.useEffect(() => {
        if (!visible) return;
        if (shouldVirtualize) {
            virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
            return;
        }
        const option = document.getElementById(`${listboxId}-option-${selectedIndex}`);
        option?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex, visible, listboxId, shouldVirtualize, virtualizer]);

    // Debounced async search
    React.useEffect(() => {
        if (!onSearch) return;
        if (!searchQuery || (isSelectedOption && !isTyping)) {
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
    }, [searchQuery, onSearch, isSelectedOption, isTyping]);

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
        isTypingRef.current = false;
        setIsTyping(false);
        // Set label immediately so sync effect doesn't flash the ID
        const selectedOption = [...(asyncOptions ?? []), ...options].find(
            (option) => option.value === optionValue,
        );
        if (selectedOption) {
            setSearchQuery(selectedOption.label);
            searchQueryRef.current = selectedOption.label;
            // Remember this selection so the label survives asyncOptions clearing
            setSelectedCache((prev) =>
                prev.some((cached) => cached.value === selectedOption.value)
                    ? prev
                    : [...prev, selectedOption],
            );
        }
        onChange(optionValue);
        onSelect?.(optionValue);
        // Instant close on select — exit animation only runs for blur/Escape.
        clearTimeout(closingTimerRef.current);
        setShowList(false);
        setVisible(false);
        setClosing(false);
        setAsyncOptions(null);
        // queueMicrotask waits for the current task (including React's commit
        // from the state updates above) to finish, but runs before the next
        // frame — much faster than setTimeout(0) + requestAnimationFrame.
        queueMicrotask(() => {
            selectingRef.current = false;
            innerRef.current?.dispatchEvent(new CustomEvent("combobox-select", { bubbles: true }));
            onAfterSelect?.(optionValue);
        });
    };

    const handleFocus = () => {
        measurePos();
        // Don't open dropdown on focus — wait for user to type or press ArrowDown
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (selectingRef.current) return;
            setShowList(false);
            // If user was typing and cleared the input, clear the value
            if (isTypingRef.current && !searchQueryRef.current) {
                onChange("");
            }
            isTypingRef.current = false;
            setIsTyping(false);
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
                // Wrap to start
                for (let i = 0; i < prev; i++) {
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
                // Wrap to end
                for (let i = filtered.length - 1; i > prev; i--) {
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
        if (isTyping) return; // Don't overwrite search text while user is typing
        if (!value) {
            setSearchQuery("");
            searchQueryRef.current = "";
        } else if (isSelectedOption) {
            const label = allKnownOptions.find((option) => option.value === value)?.label ?? value;
            setSearchQuery(label);
            searchQueryRef.current = label;
        } else if (labelOverride) {
            // Value isn't in options/async/cache, but caller provided a per-row label
            setSearchQuery(labelOverride);
            searchQueryRef.current = labelOverride;
        } else {
            setSearchQuery(value);
            searchQueryRef.current = value;
        }
    }, [value, isSelectedOption, allKnownOptions, isTyping, labelOverride]);

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
                    searchQueryRef.current = q;
                    if (!isTypingRef.current) {
                        isTypingRef.current = true;
                        setIsTyping(true);
                    }
                    // Don't forward search text to parent — value changes only on
                    // explicit select or blur-clear. This prevents numeric search text
                    // (e.g. "123") from being interpreted as a product ID.
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
                        ref={(el) => {
                            (listRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                            (
                                dropdownScrollRef as React.MutableRefObject<HTMLDivElement | null>
                            ).current = el;
                        }}
                        id={listboxId}
                        role="listbox"
                        data-closing={closing || undefined}
                        data-virtualized={shouldVirtualize}
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
                        {filtered.length === 0 ? (
                            <div className="text-muted-foreground px-2 py-1.5 text-sm italic">
                                {noResultsText ?? "No results"}
                            </div>
                        ) : shouldVirtualize ? (
                            <div
                                style={{
                                    height: virtualizer.getTotalSize(),
                                    position: "relative",
                                    width: "100%",
                                }}
                            >
                                {virtualizer.getVirtualItems().map((virtualRow) => {
                                    const option = filtered[virtualRow.index];
                                    if (!option) return null;
                                    return (
                                        <div
                                            key={option.value}
                                            id={`${listboxId}-option-${virtualRow.index}`}
                                            role="option"
                                            aria-selected={selectedIndex === virtualRow.index}
                                            aria-disabled={option.disabled ?? undefined}
                                            title={
                                                option.disabled ? option.disabledReason : undefined
                                            }
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (option.disabled) return;
                                                handleSelect(option.value);
                                            }}
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "100%",
                                                height: virtualRow.size,
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            className={cn(
                                                "flex items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none",
                                                option.disabled
                                                    ? "text-muted-foreground cursor-not-allowed opacity-50"
                                                    : "cursor-pointer",
                                                !option.disabled &&
                                                    selectedIndex === virtualRow.index
                                                    ? "bg-accent text-accent-foreground"
                                                    : !option.disabled && "hover:bg-accent/50",
                                            )}
                                        >
                                            {option.label}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
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
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
}
