import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createElement } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const MOTION_PROPS = new Set([
    "whileTap", "whileHover", "whileFocus", "whileDrag", "whileInView",
    "initial", "animate", "exit", "transition", "variants", "layout",
    "layoutId", "onAnimationStart", "onAnimationComplete",
]);

function filterMotionProps(props: Record<string, any>) {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!MOTION_PROPS.has(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

const motionCache = new Map<string, any>();
function getMotionComponent(prop: string) {
    if (!motionCache.has(prop)) {
        motionCache.set(prop, ({ children, className, ...rest }: any) =>
            createElement(prop, { className, ...filterMotionProps(rest) }, children),
        );
    }
    return motionCache.get(prop);
}

mock.module("motion/react", () => ({
    motion: new Proxy({}, { get: (_target: any, prop: string) => getMotionComponent(prop) }),
    AnimatePresence: ({ children }: any) => createElement("div", null, children),
}));

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    Button: ({ children, onClick, disabled, className, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} className={className} {...filterMotionProps(props)}>
            {children}
        </button>
    ),
    Input: ({ className, value, onChange, ref, ...props }: any) => (
        <input className={className} defaultValue={value} onChange={onChange} ref={ref} {...filterMotionProps(props)} />
    ),
    TableBody: ({ children, ...props }: any) => <tbody {...filterMotionProps(props)}>{children}</tbody>,
    TableCell: ({ children, colSpan, ...props }: any) => <td colSpan={colSpan} {...filterMotionProps(props)}>{children}</td>,
    TableRow: ({ children, ...props }: any) => <tr {...filterMotionProps(props)}>{children}</tr>,
    motion: new Proxy({}, { get: (_target: any, prop: string) => getMotionComponent(prop) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    Select: ({ children, onValueChange, value, ...props }: any) => (
        <select value={value} onChange={(event: any) => onValueChange?.(event.target.value)} {...filterMotionProps(props)}>
            {children}
        </select>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ children, value, ...props }: any) => (
        <option value={value} {...filterMotionProps(props)}>
            {children}
        </option>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
}));

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableNewRow } from "../../../../../../packages/ui/src/components/data-table/data-table-new-row";

// ── Test data ──────────────────────────────────────────────────
interface TestRow {
    id: number;
    name: string;
    value: number;
}

const baseColumns: ColumnDef<TestRow, any>[] = [
    { accessorKey: "id", header: "ID", meta: { editable: true, inputType: "text" as const } },
    { accessorKey: "name", header: "Name", meta: { editable: true, inputType: "text" as const } },
    { accessorKey: "value", header: "Value", meta: { editable: true, inputType: "number" as const } },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTableNewRow", () => {
    let onSave: ReturnType<typeof mock>;
    let onChange: ReturnType<typeof mock>;

    beforeEach(() => {
        onSave = mock(() => {});
        onChange = mock(() => {});
    });

    // ── Uncontrolled mode (existing behavior) ──────────────────
    describe("Uncontrolled mode", () => {
        test("should render with default values", () => {
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        columns={baseColumns}
                        onSave={onSave}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const row = container.querySelector("tr");
            expect(row).toBeDefined();
            const inputs = row?.querySelectorAll("input");
            expect(inputs?.length).toBeGreaterThan(0);
        });

        test("should call onChange when input value changes", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1] as HTMLInputElement;

            await user.type(nameInput, "Test");

            // onChange is called via effect - check the last call (first may be initial render)
            const lastCallIndex = onChange.mock.calls.length - 1;
            const callArgs = onChange.mock.calls[lastCallIndex][0];
            expect(callArgs.name).toBe("Test");
        });

        test("should call onSave when Enter is pressed on last field", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        columns={baseColumns}
                        onSave={onSave}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const inputs = container.querySelectorAll("input");
            const lastInput = inputs[inputs.length - 1] as HTMLInputElement;

            lastInput.focus();
            await user.keyboard("{Enter}");

            expect(onSave).toHaveBeenCalled();
        });

        test("should maintain internal state when not controlled", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        columns={baseColumns}
                        onSave={onSave}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1] as HTMLInputElement;

            await user.type(nameInput, "Internal");

            expect(nameInput.value).toBe("Internal");
        });
    });

    // ── Controlled mode (new) ──────────────────────────────────
    describe("Controlled mode", () => {
        test("should call onChange when typing in controlled mode", async () => {
            const user = userEvent.setup();
            const externalValues = { id: 1, name: "External", value: 50 };

            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        id="controlled-row"
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                        externalValues={externalValues}
                    />
                </tbody></table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1] as HTMLInputElement;

            await user.clear(nameInput);
            await user.type(nameInput, "NewValue");

            // onChange should be called (controlled mode calls onChange directly via setValues)
            expect(onChange).toHaveBeenCalled();
        });

        test("should display external errors", () => {
            const externalValues = { id: 1, name: "", value: 0 };
            const externalErrors = { name: "Name is required" };

            const { getByText } = render(
                <table><tbody>
                    <DataTableNewRow
                        id="error-row"
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                        externalValues={externalValues}
                        externalErrors={externalErrors}
                    />
                </tbody></table>,
            );

            expect(getByText("Name is required")).toBeDefined();
        });

        test("should preserve controlled errors on save attempt", async () => {
            const user = userEvent.setup();
            const externalValues = { id: 0, name: "", value: 0 };
            const externalErrors = { name: "Invalid name" };

            const { container, getByText } = render(
                <table><tbody>
                    <DataTableNewRow
                        id="preserve-error-row"
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                        externalValues={externalValues}
                        externalErrors={externalErrors}
                    />
                </tbody></table>,
            );

            // Error should be visible
            expect(getByText("Invalid name")).toBeDefined();

            // Try to save via Enter on last input
            const inputs = container.querySelectorAll("input");
            const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
            lastInput.focus();
            await user.keyboard("{Enter}");

            // Error should still be visible (parent controls errors)
            expect(getByText("Invalid name")).toBeDefined();
        });

        test("should use custom id when provided", () => {
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        id="custom-id-row"
                        columns={baseColumns}
                        onSave={onSave}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const row = container.querySelector("tr");
            expect(row?.id).toBe("custom-id-row");
        });

        test("should default to 'new-row' id when not provided", () => {
            const { container } = render(
                <table><tbody>
                    <DataTableNewRow
                        columns={baseColumns}
                        onSave={onSave}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                    />
                </tbody></table>,
            );

            const row = container.querySelector("tr");
            expect(row?.id).toBe("new-row");
        });
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should handle empty externalValues object", () => {
        const { container } = render(
            <table><tbody>
                <DataTableNewRow
                    id="empty-external"
                    columns={baseColumns}
                    onSave={onSave}
                    onChange={onChange}
                    defaultValues={{ id: 0, name: "", value: 0 }}
                    externalValues={{}}
                />
            </tbody></table>,
        );

        const row = container.querySelector("tr");
        expect(row).toBeDefined();
    });

    test("should handle undefined externalErrors", () => {
        const { container } = render(
            <table><tbody>
                <DataTableNewRow
                    id="no-errors"
                    columns={baseColumns}
                    onSave={onSave}
                    onChange={onChange}
                    defaultValues={{ id: 0, name: "", value: 0 }}
                    externalValues={{ id: 1, name: "Test", value: 10 }}
                    externalErrors={undefined}
                />
            </tbody></table>,
        );

        const row = container.querySelector("tr");
        expect(row).toBeDefined();
    });
});
