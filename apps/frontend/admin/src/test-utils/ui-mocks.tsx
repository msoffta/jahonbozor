import { mock } from "bun:test";
import { createElement } from "react";
import * as React from "react";

// Import real DataTable components from source
import { DataTable } from "../../../../../packages/ui/src/components/data-table/data-table";
import { DataTableMultiNewRows } from "../../../../../packages/ui/src/components/data-table/data-table-multi-new-rows";
import { DataTableNewRow } from "../../../../../packages/ui/src/components/data-table/data-table-new-row";
import { DataTableSkeleton } from "../../../../../packages/ui/src/components/data-table/data-table-skeleton";

/**
 * Comprehensive set of props that should be filtered out before spreading to DOM elements.
 * Includes Motion (framer-motion/motion) props, Radix UI props, and other framework-specific props.
 */
const FILTER_PROPS = new Set([
    // Motion props (framer-motion / motion/react)
    "whileTap",
    "whileHover",
    "whileFocus",
    "whileDrag",
    "whileInView",
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "layout",
    "layoutId",
    "layoutRoot",
    "layoutScroll",
    "layoutDependency",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragStart",
    "onDrag",
    "onDragEnd",
    "onDirectionLock",
    "onViewportEnter",
    "onViewportLeave",
    "drag",
    "dragConstraints",
    "dragElastic",
    "dragMomentum",
    "dragTransition",
    "dragPropagation",
    "dragControls",
    "dragListener",
    "dragSnapToOrigin",
    "onDragTransitionEnd",
    "onTap",
    "onTapStart",
    "onTapCancel",
    "onHoverStart",
    "onHoverEnd",
    "onPan",
    "onPanStart",
    "onPanEnd",
    // Radix UI props
    "asChild",
    // Other framework-specific props
    "motionProps",
]);

/**
 * Filters out non-DOM props from the given props object.
 * Use this before spreading props to native DOM elements to prevent React warnings.
 */
export function filterDOMProps(props: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!FILTER_PROPS.has(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

/**
 * Motion component factory with caching.
 * Returns the same function reference per element type to ensure React can reconcile properly.
 */
const motionCache = new Map<string, any>();
function getMotionComponent(prop: string) {
    if (!motionCache.has(prop)) {
        motionCache.set(
            prop,
            ({ children, className, ...rest }: any) =>
                createElement(
                    prop,
                    { className, ...filterDOMProps(rest) },
                    children,
                ),
        );
    }
    return motionCache.get(prop);
}

/**
 * Centralized UI component mocks for testing.
 * These mocks are designed to work with @testing-library/user-event and provide proper DOM elements.
 *
 * IMPORTANT: Real DataTable components are included here so tests can use them
 * while still mocking the UI primitives and motion components.
 */
export const uiMocks = {
    // Utility function
    cn: (...args: any[]) => args.filter(Boolean).join(" "),

    // Real DataTable components (not mocks!)
    DataTable,
    DataTableMultiNewRows,
    DataTableNewRow,
    DataTableSkeleton,

    // Input: Supports both controlled and uncontrolled modes
    Input: React.forwardRef(
        (
            {
                className,
                value,
                defaultValue,
                onChange,
                ...props
            }: any,
            ref: any,
        ) => {
            const [internalValue, setInternalValue] = React.useState(
                defaultValue ?? "",
            );
            const isControlled = value !== undefined;
            const currentValue = isControlled ? value : internalValue;

            return (
                <input
                    ref={ref}
                    className={className}
                    value={currentValue}
                    onChange={(e) => {
                        if (!isControlled) setInternalValue(e.target.value);
                        onChange?.(e);
                    }}
                    {...filterDOMProps(props)}
                />
            );
        },
    ),

    // Button: Filters asChild prop
    Button: React.forwardRef(
        (
            { children, className, asChild, ...props }: any,
            ref: any,
        ) => (
            <button
                ref={ref}
                className={className}
                {...filterDOMProps(props)}
            >
                {children}
            </button>
        ),
    ),

    // Checkbox
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e: any) => onCheckedChange?.(e.target.checked)}
            {...filterDOMProps(props)}
        />
    ),

    // Select components
    Select: ({ children, onValueChange, value, ...props }: any) => (
        <select
            value={value}
            onChange={(e: any) => onValueChange?.(e.target.value)}
            {...filterDOMProps(props)}
        >
            {children}
        </select>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ children, value, ...props }: any) => (
        <option value={value} {...filterDOMProps(props)}>
            {children}
        </option>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,

    // Table components
    Table: ({ children, className, ...props }: any) => (
        <table className={className} {...filterDOMProps(props)}>
            {children}
        </table>
    ),
    TableBody: ({ children, ...props }: any) => (
        <tbody {...filterDOMProps(props)}>{children}</tbody>
    ),
    TableCell: ({ children, colSpan, ...props }: any) => (
        <td colSpan={colSpan} {...filterDOMProps(props)}>
            {children}
        </td>
    ),
    TableHead: ({ children, colSpan, ...props }: any) => (
        <th colSpan={colSpan} {...filterDOMProps(props)}>
            {children}
        </th>
    ),
    TableHeader: ({ children, ...props }: any) => (
        <thead {...filterDOMProps(props)}>{children}</thead>
    ),
    TableRow: ({ children, ...props }: any) => (
        <tr {...filterDOMProps(props)}>{children}</tr>
    ),

    // Tooltip components
    Tooltip: ({ children }: any) => <>{children}</>,
    TooltipContent: ({ children }: any) => <div>{children}</div>,
    TooltipProvider: ({ children }: any) => <>{children}</>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,

    // DropdownMenu components
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick, ...props }: any) => (
        <button type="button" onClick={onClick} {...filterDOMProps(props)}>
            {children}
        </button>
    ),
    DropdownMenuLabel: ({ children }: any) => <span>{children}</span>,
    DropdownMenuSeparator: () => <hr />,

    // Motion components
    motion: new Proxy(
        {},
        { get: (_target: any, prop: string) => getMotionComponent(prop) },
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    LayoutGroup: ({ children }: any) => <>{children}</>,
};

/**
 * Sets up all UI mocks for testing.
 * Call this at the top of your test file, BEFORE importing components.
 *
 * @example
 * ```typescript
 * import { setupUIMocks } from "../test-utils/ui-mocks";
 *
 * setupUIMocks();
 *
 * import { MyComponent } from "../my-component";
 * ```
 */
export function setupUIMocks() {
    // Mock motion/react - DataTable sub-components import motion directly
    mock.module("motion/react", () => ({
        motion: uiMocks.motion,
        AnimatePresence: uiMocks.AnimatePresence,
        LayoutGroup: uiMocks.LayoutGroup,
    }));

    // Mock @jahonbozor/ui - must be AFTER motion/react mock
    mock.module("@jahonbozor/ui", () => uiMocks);
}
