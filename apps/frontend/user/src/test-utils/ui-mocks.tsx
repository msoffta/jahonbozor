import { mock } from "bun:test";
import { createElement } from "react";

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
 * These mocks are designed to work with @testing-library and provide proper DOM elements.
 */
export const uiMocks = {
    // Utility function
    cn: (...args: any[]) => args.filter(Boolean).join(" "),

    // Checkbox
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e: any) => onCheckedChange?.(e.target.checked)}
            data-testid="checkbox"
            {...filterDOMProps(props)}
        />
    ),

    // Skeleton
    Skeleton: ({ className, ...props }: any) => (
        <div className={className} data-testid="skeleton" {...filterDOMProps(props)} />
    ),

    // Motion components
    motion: new Proxy(
        {},
        { get: (_target: any, prop: string) => getMotionComponent(prop) },
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
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
    // Mock motion/react
    mock.module("motion/react", () => ({
        motion: uiMocks.motion,
        AnimatePresence: uiMocks.AnimatePresence,
    }));

    // Mock @jahonbozor/ui
    mock.module("@jahonbozor/ui", () => uiMocks);
}
