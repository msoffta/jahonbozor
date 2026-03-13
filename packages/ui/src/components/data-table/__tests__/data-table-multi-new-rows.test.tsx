import { describe, test, expect, mock, beforeEach } from "bun:test";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import * as React from "react";

// Helper to filter non-DOM props
const filterDOMProps = (props: Record<string, any>) => {
    const FILTER_PROPS = new Set(["whileTap", "whileHover", "initial", "animate", "exit", "transition", "asChild"]);
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!FILTER_PROPS.has(key)) filtered[key] = value;
    }
    return filtered;
};

// Mock motion/react
mock.module("motion/react", () => ({
    motion: new Proxy({}, {
        get: (_target: any, prop: string) => {
            return ({ children, className, ...rest }: any) =>
                createElement(prop, { className, ...filterDOMProps(rest) }, children);
        },
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    LayoutGroup: ({ children }: any) => <>{children}</>,
}));

// Mock UI components that DataTable depends on
mock.module("../../ui/button.tsx", () => ({
    Button: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
        <button ref={ref} className={className} {...filterDOMProps(props)}>{children}</button>
    )),
}));

mock.module("../../ui/checkbox.tsx", () => ({
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...filterDOMProps(props)} />
    ),
}));

// НЕ мокируем Input - реальный компонент работает правильно

mock.module("../../ui/table.tsx", () => ({
    Table: ({ children, className, style }: any) => <table className={className} style={style}>{children}</table>,
    TableBody: ({ children, style }: any) => <tbody style={style}>{children}</tbody>,
    TableCell: ({ children, colSpan, style }: any) => <td colSpan={colSpan} style={style}>{children}</td>,
    TableHead: ({ children, colSpan, style }: any) => <th colSpan={colSpan} style={style}>{children}</th>,
    TableHeader: ({ children, className, style }: any) => <thead className={className} style={style}>{children}</thead>,
    TableRow: ({ children, style }: any) => <tr style={style}>{children}</tr>,
}));

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableMultiNewRows } from "../data-table-multi-new-rows";
import type { NewRowState } from "../types";

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

const createNewRowStates = (count: number): NewRowState[] => {
    return Array.from({ length: count }, (_, index) => ({
        id: `__new_row_${Date.now()}_${index}`,
        values: {},
        errors: {},
    }));
};

// ── Tests ──────────────────────────────────────────────────────
describe("DataTableMultiNewRows", () => {
    let onRowChange: ReturnType<typeof mock>;
    let onRowSave: ReturnType<typeof mock>;
    let onNeedMoreRows: ReturnType<typeof mock>;
    let defaultValuesFactory: ReturnType<typeof mock>;

    beforeEach(() => {
        mock.clearAllMocks();
        onRowChange = mock(() => {});
        onRowSave = mock(() => {});
        onNeedMoreRows = mock(() => {});
        defaultValuesFactory = mock((_index: number) => ({ id: 0, name: "", value: 0 }));
    });

    // ── Happy path ─────────────────────────────────────────────
    test("should render multiple new rows", () => {
        const rowStates = createNewRowStates(15);

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const multiRowsElement = getByTestId("multi-new-rows");
        const rows = multiRowsElement.querySelectorAll("tr[data-row-id]");
        expect(rows.length).toBe(15);
    });

    test("should call onRowChange when input value changes", async () => {
        const user = userEvent.setup();
        const rowStates = createNewRowStates(3);
        const firstRowId = rowStates[0].id;

        const { getAllByRole } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        // Get first input from first row (3 columns, so first 3 inputs are first row)
        const inputs = getAllByRole("textbox");
        await user.type(inputs[0], "test value");

        // onChange is called on each keystroke with the rowId
        expect(onRowChange).toHaveBeenCalled();
        expect(onRowChange.mock.calls[0][0]).toBe(firstRowId);
    });

    test("should call onRowSave when Enter pressed on last input", async () => {
        const user = userEvent.setup();
        const rowStates = createNewRowStates(3);
        const secondRowId = rowStates[1].id;

        const { getAllByRole } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        // Second row has 3 inputs: spinbutton (number) at indices 3,4,5
        // Last input is index 5, but we need to use the "spinbutton" role for number inputs
        const numberInputs = getAllByRole("spinbutton"); // value (indices 0 for row 1, 1 for row 2)

        // Last input of second row is the number input at index 1
        const lastInputOfSecondRow = numberInputs[1];

        lastInputOfSecondRow.focus();
        await user.keyboard("{Enter}");

        expect(onRowSave).toHaveBeenCalledWith(secondRowId);
    });

    test("should render sentinel element for IntersectionObserver", () => {
        const rowStates = createNewRowStates(15);

        const { container } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const sentinel = container.querySelector("tr[aria-hidden='true']");
        expect(sentinel).toBeDefined();
    });

    test("should call defaultValuesFactory for each row with correct index", () => {
        const rowStates = createNewRowStates(5);

        render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should render empty tbody when rowStates is empty", () => {
        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={[]}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const multiRowsElement = getByTestId("multi-new-rows");
        const rows = multiRowsElement.querySelectorAll("tr[data-row-id]");
        expect(rows.length).toBe(0);
    });

    test("should handle single new row", () => {
        const rowStates = createNewRowStates(1);

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const multiRowsElement = getByTestId("multi-new-rows");
        const rows = multiRowsElement.querySelectorAll("tr[data-row-id]");
        expect(rows.length).toBe(1);
    });

    test("should handle rowStates with existing values", () => {
        const rowStates: NewRowState[] = [
            {
                id: "__new_row_1",
                values: { name: "Existing", value: 100 },
                errors: {},
            },
        ];

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const row = getByTestId("multi-new-rows").querySelector("tr[data-row-id='__new_row_1']");
        expect(row).toBeDefined();
    });

    test("should handle rowStates with errors", () => {
        const rowStates: NewRowState[] = [
            {
                id: "__new_row_error",
                values: { name: "Test" },
                errors: { name: "Name is required" },
            },
        ];

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const row = getByTestId("multi-new-rows").querySelector("tr[data-row-id='__new_row_error']");
        expect(row).toBeDefined();
    });

    // ── Boundary values ────────────────────────────────────────
    test("should handle maximum allowed rows (100)", () => {
        const rowStates = createNewRowStates(100);

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const multiRowsElement = getByTestId("multi-new-rows");
        const rows = multiRowsElement.querySelectorAll("tr[data-row-id]");
        expect(rows.length).toBe(100);
    });

    test("should maintain unique row IDs", () => {
        const rowStates = createNewRowStates(20);

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const multiRowsElement = getByTestId("multi-new-rows");
        const rows = multiRowsElement.querySelectorAll("tr[data-row-id]");
        const ids = Array.from(rows).map((row) => row.getAttribute("data-row-id"));
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(20);
    });

    // ── Controlled mode ────────────────────────────────────────
    test("should work in controlled mode with external values", () => {
        const rowStates: NewRowState[] = [
            {
                id: "__new_row_controlled",
                values: { name: "Controlled Value", value: 42 },
                errors: {},
            },
        ];

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const row = getByTestId("multi-new-rows").querySelector("tr[data-row-id='__new_row_controlled']");
        expect(row).toBeDefined();
    });

    test("should work in controlled mode with external errors", () => {
        const rowStates: NewRowState[] = [
            {
                id: "__new_row_with_error",
                values: { name: "" },
                errors: { name: "Name is required", value: "Value must be positive" },
            },
        ];

        const { getByTestId } = render(
            <table>
                <tbody data-testid="multi-new-rows">
                    <DataTableMultiNewRows
                        columns={baseColumns}
                        rowStates={rowStates}
                        onRowChange={onRowChange}
                        onRowSave={onRowSave}
                        defaultValuesFactory={defaultValuesFactory}
                        onNeedMoreRows={onNeedMoreRows}
                    />
                </tbody>
            </table>,
        );

        const row = getByTestId("multi-new-rows").querySelector("tr[data-row-id='__new_row_with_error']");
        expect(row).toBeDefined();
    });
});
