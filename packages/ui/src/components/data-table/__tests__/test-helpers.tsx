import { createElement } from "react";
import * as React from "react";

// ── Shared DOM prop filter ──────────────────────────────────────
const FILTER_PROPS = new Set([
    "whileTap",
    "whileHover",
    "initial",
    "animate",
    "exit",
    "transition",
    "asChild",
]);

export const filterDOMProps = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!FILTER_PROPS.has(key)) filtered[key] = value;
    }
    return filtered;
};

// ── Mock implementations ────────────────────────────────────────
// Usage: mock.module("motion/react", () => motionMock);
// Must be called BEFORE component imports in each test file.

export const motionMock = {
    motion: new Proxy(
        {},
        {
            get: (_target: unknown, prop: string) => {
                return ({
                    children,
                    className,
                    ...rest
                }: {
                    children?: React.ReactNode;
                    className?: string;
                    [key: string]: unknown;
                }) =>
                    createElement(
                        prop,
                        { className, ...filterDOMProps(rest) },
                        children,
                    );
            },
        },
    ),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    LayoutGroup: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
};

export const buttonMock = {
    Button: React.forwardRef(
        (
            {
                children,
                className,
                ...props
            }: {
                children?: React.ReactNode;
                className?: string;
                [key: string]: unknown;
            },
            ref: React.Ref<HTMLButtonElement>,
        ) => (
            <button ref={ref} className={className} {...filterDOMProps(props)}>
                {children}
            </button>
        ),
    ),
};

export const checkboxMock = {
    Checkbox: ({
        checked,
        onCheckedChange,
        ...props
    }: {
        checked?: boolean;
        onCheckedChange?: (checked: boolean) => void;
        [key: string]: unknown;
    }) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            {...filterDOMProps(props)}
        />
    ),
};

export const selectMock = {
    Select: ({
        children,
        onValueChange,
        value,
    }: {
        children?: React.ReactNode;
        onValueChange?: (value: string) => void;
        value?: string;
    }) => (
        <select
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
        >
            {children}
        </select>
    ),
    SelectContent: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    SelectItem: ({
        children,
        value,
    }: {
        children?: React.ReactNode;
        value: string;
    }) => <option value={value}>{children}</option>,
    SelectTrigger: () => null,
    SelectValue: () => null,
};

export const tableMock = {
    Table: ({
        children,
        className,
        style,
    }: {
        children?: React.ReactNode;
        className?: string;
        style?: React.CSSProperties;
    }) => (
        <table className={className} style={style}>
            {children}
        </table>
    ),
    TableBody: ({
        children,
        style,
    }: {
        children?: React.ReactNode;
        style?: React.CSSProperties;
    }) => <tbody style={style}>{children}</tbody>,
    TableCell: ({
        children,
        colSpan,
        style,
    }: {
        children?: React.ReactNode;
        colSpan?: number;
        style?: React.CSSProperties;
    }) => (
        <td colSpan={colSpan} style={style}>
            {children}
        </td>
    ),
    TableHead: ({
        children,
        colSpan,
        style,
    }: {
        children?: React.ReactNode;
        colSpan?: number;
        style?: React.CSSProperties;
    }) => (
        <th colSpan={colSpan} style={style}>
            {children}
        </th>
    ),
    TableHeader: ({
        children,
        className,
        style,
    }: {
        children?: React.ReactNode;
        className?: string;
        style?: React.CSSProperties;
    }) => (
        <thead className={className} style={style}>
            {children}
        </thead>
    ),
    TableRow: ({
        children,
        style,
    }: {
        children?: React.ReactNode;
        style?: React.CSSProperties;
    }) => <tr style={style}>{children}</tr>,
};

export const dropdownMenuMock = {
    DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuItem: ({
        children,
        onClick,
    }: {
        children?: React.ReactNode;
        onClick?: () => void;
    }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => (
        <span>{children}</span>
    ),
    DropdownMenuSeparator: () => <hr />,
};
