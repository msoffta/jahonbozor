import { createElement } from "react";
import * as React from "react";

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
        motionCache.set(prop, ({ children, className, ...rest }: any) =>
            createElement(prop, { className, ...filterDOMProps(rest) }, children),
        );
    }
    return motionCache.get(prop);
}

/**
 * Motion library mocks (motion/react).
 * Use with vi.mock("motion/react", async () => { const { motionMocks } = await import("..."); return motionMocks; })
 */
export const motionMocks = {
    motion: new Proxy({}, { get: (_target: any, prop: string) => getMotionComponent(prop) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    LayoutGroup: ({ children }: any) => <>{children}</>,
};

/**
 * Centralized UI component mocks for testing.
 * These mocks are designed to work with @testing-library/user-event and provide proper DOM elements.
 */
export const uiMocks = {
    // Utility function
    cn: (...args: any[]) => args.filter(Boolean).join(" "),

    // Input: Supports both controlled and uncontrolled modes
    Input: ({ ref, className, value, defaultValue, onChange, ...props }: any) => {
        const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
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

    // Button: Filters asChild prop
    Button: ({ ref, children, className, asChild: _asChild, ...props }: any) => (
        <button ref={ref} className={className} {...filterDOMProps(props)}>
            {children}
        </button>
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
    TableRow: ({ children, ...props }: any) => <tr {...filterDOMProps(props)}>{children}</tr>,

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

    // Card components
    Card: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    CardContent: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    CardHeader: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    CardTitle: ({ children, className, ...props }: any) => (
        <h3 className={className} {...filterDOMProps(props)}>
            {children}
        </h3>
    ),

    // Drawer components
    Drawer: ({ children, open }: any) => (open ? <div data-testid="drawer">{children}</div> : null),
    DrawerContent: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    DrawerHeader: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    DrawerTitle: ({ children, className, ...props }: any) => (
        <h2 className={className} {...filterDOMProps(props)}>
            {children}
        </h2>
    ),
    DrawerFooter: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),

    // Layout components
    ScrollArea: ({ children, className, ...props }: any) => (
        <div className={className} {...filterDOMProps(props)}>
            {children}
        </div>
    ),
    Badge: ({ children, className, ...props }: any) => (
        <span className={className} {...filterDOMProps(props)}>
            {children}
        </span>
    ),
    Skeleton: ({ className, ...props }: any) => (
        <div className={className} data-testid="skeleton" {...filterDOMProps(props)} />
    ),
    Separator: ({ className, ...props }: any) => (
        <hr className={className} {...filterDOMProps(props)} />
    ),

    // DataTable components
    DataTable: ({ data, columns: _columns, ...props }: any) => (
        <div data-testid="data-table" data-row-count={data?.length ?? 0} {...filterDOMProps(props)}>
            data-table
        </div>
    ),
    DataTableSkeleton: ({ columns: _columns, rows: _rows, ...props }: any) => (
        <div data-testid="data-table-skeleton" {...filterDOMProps(props)}>
            loading
        </div>
    ),
};
