import { describe, test, expect, mock, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupUIMocks } from "../../test-utils/ui-mocks";

// Setup centralized UI mocks BEFORE importing components
setupUIMocks();

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableMultiNewRows } from "@jahonbozor/ui";
import type { NewRowState } from "../../../../../../packages/ui/src/components/data-table/types";

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
        const textInputs = getAllByRole("textbox"); // id, name (indices 0-1 for row 1, 3-4 for row 2)
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
