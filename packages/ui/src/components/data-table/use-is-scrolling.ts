import * as React from "react";

/** Ms of scroll idleness before we consider scrolling to have stopped. */
const SCROLL_IDLE_TIMEOUT_MS = 150;

/**
 * Returns `true` while the given scroll element is actively being scrolled.
 * Flips back to `false` after `SCROLL_IDLE_TIMEOUT_MS` of no scroll events.
 *
 * Used to cheapen row mounts during virtualized scroll: editable cells can
 * render a lightweight display div while `isScrolling` is true and upgrade
 * back to full inputs (Radix Select / Combobox / etc.) once the user stops.
 */
export function useIsScrolling(scrollElement: HTMLElement | null | undefined): boolean {
    const [isScrolling, setIsScrolling] = React.useState(false);

    React.useEffect(() => {
        if (!scrollElement) return;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleScroll = () => {
            setIsScrolling(true);
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => setIsScrolling(false), SCROLL_IDLE_TIMEOUT_MS);
        };

        scrollElement.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            scrollElement.removeEventListener("scroll", handleScroll);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [scrollElement]);

    return isScrolling;
}

/**
 * Context broadcasting the current scroll-in-progress flag from DataTableBody
 * to any descendant (editable cells, combobox triggers, etc.) that wants to
 * defer expensive work until scrolling stops.
 */
export const DataTableScrollingContext = React.createContext(false);
