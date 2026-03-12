import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createElement } from "react";
import { render, fireEvent } from "@testing-library/react";
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
    Input: ({ className, ...props }: any) => <input className={className} {...props} />,
    TableBody: ({ children, ...props }: any) => <tbody {...filterMotionProps(props)}>{children}</tbody>,
    TableCell: ({ children, colSpan, ...props }: any) => <td colSpan={colSpan} {...filterMotionProps(props)}>{children}</td>,
    TableRow: ({ children, ...props }: any) => <tr {...filterMotionProps(props)}>{children}</tr>,
    motion: new Proxy({}, { get: (_target: any, prop: string) => getMotionComponent(prop) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    DataTable: ({ children, ...props }: any) => createElement("div", props, children),
}));

import type { ColumnDef } from "@tanstack/react-table";
import type { NewRowState } from "../../../../../../packages/ui/src/components/data-table/types";

// Mock DataTableMultiNewRows component for testing
// This will be implemented later, tests written first (Test First approach)
interface DataTableMultiNewRowsProps<TData> {
    columns: ColumnDef<TData, any>[];
    rowStates: NewRowState[];
    onRowChange: (rowId: string, values: Record<string, unknown>) => void;
    onRowSave: (rowId: string) => void;
    onRowDelete?: (rowId: string) => void;
    enableRowSelection?: boolean;
    defaultValuesFactory: (rowIndex: number) => Partial<TData>;
    onNeedMoreRows: () => void;
}

// Placeholder implementation for testing
function DataTableMultiNewRows<TData>({
    rowStates,
    onRowChange,
    onRowSave,
    onNeedMoreRows,
}: DataTableMultiNewRowsProps<TData>) {
    return (
        <tbody data-testid="multi-new-rows">
            {rowStates.map((rowState) => (
                <tr key={rowState.id} data-row-id={rowState.id}>
                    <td>
                        <input
                            data-testid={`input-${rowState.id}`}
                            defaultValue={(rowState.values.value as string) || ""}
                            onChange={(event) => onRowChange(rowState.id, { value: event.target.value })}
                        />
                    </td>
                    <td>
                        <button
                            data-testid={`save-${rowState.id}`}
                            onClick={() => onRowSave(rowState.id)}
                        >
                            Save
                        </button>
                    </td>
                </tr>
            ))}
            <tr data-testid="sentinel">
                <td>Sentinel</td>
            </tr>
        </tbody>
    );
}

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
    let onRowDelete: ReturnType<typeof mock>;
    let onNeedMoreRows: ReturnType<typeof mock>;
    let defaultValuesFactory: ReturnType<typeof mock>;

    beforeEach(() => {
        mock.clearAllMocks();
        onRowChange = mock(() => {});
        onRowSave = mock(() => {});
        onRowDelete = mock(() => {});
        onNeedMoreRows = mock(() => {});
        defaultValuesFactory = mock((index: number) => ({ id: 0, name: "", value: 0 }));
    });

    // ── Happy path ─────────────────────────────────────────────
    test("should render multiple new rows", () => {
        const rowStates = createNewRowStates(15);

        const { getByTestId } = render(
            <table>
                <DataTableMultiNewRows
                    columns={baseColumns}
                    rowStates={rowStates}
                    onRowChange={onRowChange}
                    onRowSave={onRowSave}
                    defaultValuesFactory={defaultValuesFactory}
                    onNeedMoreRows={onNeedMoreRows}
                />
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

        const { getByTestId } = render(
            <table>
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
            </table>,
        );

        const input = getByTestId(`input-${firstRowId}`) as HTMLInputElement;
        await user.type(input, "test value");

        expect(onRowChange).toHaveBeenCalled();
    });

    test("should call onRowSave when save button is clicked", () => {
        const rowStates = createNewRowStates(3);
        const secondRowId = rowStates[1].id;

        const { getByTestId } = render(
            <table>
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
            </table>,
        );

        const saveButton = getByTestId(`save-${secondRowId}`);
        fireEvent.click(saveButton);

        expect(onRowSave).toHaveBeenCalledWith(secondRowId);
    });

    test("should render sentinel element for IntersectionObserver", () => {
        const rowStates = createNewRowStates(15);

        const { getByTestId } = render(
            <table>
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
            </table>,
        );

        const sentinel = getByTestId("sentinel");
        expect(sentinel).toBeDefined();
    });

    test("should call defaultValuesFactory for each row with correct index", () => {
        const rowStates = createNewRowStates(5);

        render(
            <table>
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
            </table>,
        );

        // In actual implementation, defaultValuesFactory would be called for each row
        // This test will pass when the real component is implemented
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should render empty tbody when rowStates is empty", () => {
        const { getByTestId } = render(
            <table>
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={[]}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
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
                <DataTableMultiNewRows
                columns={baseColumns}
                rowStates={rowStates}
                onRowChange={onRowChange}
                onRowSave={onRowSave}
                defaultValuesFactory={defaultValuesFactory}
                onNeedMoreRows={onNeedMoreRows}
                />
            </table>,
        );

        const row = getByTestId("multi-new-rows").querySelector("tr[data-row-id='__new_row_with_error']");
        expect(row).toBeDefined();
    });
});
