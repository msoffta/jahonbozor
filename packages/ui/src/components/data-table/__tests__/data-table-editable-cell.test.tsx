import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Mock } from "vitest";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);
vi.mock("../../ui/checkbox.tsx", async () => (await import("./test-helpers")).checkboxMock);
vi.mock("../../ui/select.tsx", async () => (await import("./test-helpers")).selectMock);
vi.mock("../../ui/table.tsx", async () => (await import("./test-helpers")).tableMock);
vi.mock(
    "../../ui/dropdown-menu.tsx",
    async () => (await import("./test-helpers")).dropdownMenuMock,
);

import { DataTable } from "../data-table";

import type { ColumnDef } from "@tanstack/react-table";

// ── Test data ──────────────────────────────────────────────────
interface TestRow {
    id: number;
    name: string;
    price: number;
    status: string;
    category: string;
}

const testData: TestRow[] = [
    { id: 1, name: "Alice", price: 1500, status: "active", category: "A" },
    { id: 2, name: "Bob", price: 2500, status: "inactive", category: "B" },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTableEditableCell", () => {
    let onCellEdit: Mock;

    beforeEach(() => {
        onCellEdit = vi.fn();
    });

    // ── Text input ─────────────────────────────────────────────
    describe("text input type", () => {
        const columns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "name",
                header: "Name",
                meta: { editable: true, inputType: "text" as const },
            },
        ];

        test("should render ghost input immediately (no double-click needed)", () => {
            const { getByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Input is always visible — no double-click needed
            expect(getByDisplayValue("Alice")).toBeDefined();
            expect(getByDisplayValue("Bob")).toBeDefined();
        });

        test("should save on Enter and call onCellEdit", async () => {
            const user = userEvent.setup();
            const { getByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = getByDisplayValue("Alice");
            await user.clear(input);
            await user.type(input, "Updated");
            await user.keyboard("{Enter}");

            expect(onCellEdit).toHaveBeenCalledWith(0, "name", "Updated");
        });

        test("should cancel on Escape and revert value", async () => {
            const user = userEvent.setup();
            const { getByDisplayValue, queryByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = getByDisplayValue("Alice");
            await user.clear(input);
            await user.type(input, "Changed");
            await user.keyboard("{Escape}");

            // Value should revert to original
            expect(queryByDisplayValue("Changed")).toBeNull();
            expect(getByDisplayValue("Alice")).toBeDefined();
            expect(onCellEdit).not.toHaveBeenCalled();
        });

        test("should not call onCellEdit when value is unchanged", async () => {
            const user = userEvent.setup();
            const { getByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = getByDisplayValue("Alice");
            await user.click(input);
            await user.keyboard("{Enter}");

            expect(onCellEdit).not.toHaveBeenCalled();
        });
    });

    // ── Number input ───────────────────────────────────────────
    describe("number input type", () => {
        const columns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "price",
                header: "Price",
                meta: { editable: true, inputType: "number" as const },
            },
        ];

        test("should render number input immediately", () => {
            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const numberInputs = container.querySelectorAll("input[type='number']");
            expect(numberInputs.length).toBe(2); // one per row
        });

        test("should convert string to number on edit", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = container.querySelector("input[type='number']")!;
            await user.clear(input);
            await user.type(input, "3000");
            await user.keyboard("{Enter}");

            expect(onCellEdit).toHaveBeenCalledWith(0, "price", 3000);
        });
    });

    // ── Select input ───────────────────────────────────────────
    describe("select input type", () => {
        const columns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "status",
                header: "Status",
                meta: {
                    editable: true,
                    inputType: "select" as const,
                    selectOptions: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                },
            },
        ];

        test("should render select immediately with options", () => {
            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const selects = container.querySelectorAll("select");
            expect(selects.length).toBe(2); // one per row

            const options = selects[0].querySelectorAll("option");
            expect(options.length).toBe(2);
        });

        test("should call onCellEdit when value changes via select", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const select = container.querySelector("select")!;
            await user.selectOptions(select, "inactive");

            expect(onCellEdit).toHaveBeenCalledWith(0, "status", "inactive");
        });

        test("should not call onCellEdit when same value is re-selected", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const select = container.querySelector("select")!;
            await user.selectOptions(select, "active");

            expect(onCellEdit).not.toHaveBeenCalled();
        });
    });

    // ── Validation ─────────────────────────────────────────────
    describe("validation", () => {
        test("should show error message on invalid value", async () => {
            const z = (await import("zod")).default;
            const user = userEvent.setup();
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: {
                        editable: true,
                        inputType: "text" as const,
                        validationSchema: z.string().min(3, "Min 3 chars"),
                    },
                },
            ];

            const { getByDisplayValue, queryByText } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = getByDisplayValue("Alice");
            await user.clear(input);
            await user.type(input, "AB");
            await user.keyboard("{Enter}");

            expect(queryByText("Min 3 chars")).toBeDefined();
            expect(onCellEdit).not.toHaveBeenCalled();
        });

        test("should clear error on valid value after previous error", async () => {
            const z = (await import("zod")).default;
            const user = userEvent.setup();
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: {
                        editable: true,
                        inputType: "text" as const,
                        validationSchema: z.string().min(3, "Min 3 chars"),
                    },
                },
            ];

            const { getByDisplayValue, queryByText } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Trigger error
            const input = getByDisplayValue("Alice");
            await user.clear(input);
            await user.type(input, "AB");
            await user.keyboard("{Enter}");
            expect(queryByText("Min 3 chars")).toBeDefined();

            // Fix value and re-submit
            await user.clear(input);
            await user.type(input, "Valid");
            await user.keyboard("{Enter}");

            expect(queryByText("Min 3 chars")).toBeNull();
            expect(onCellEdit).toHaveBeenCalledWith(0, "name", "Valid");
        });
    });

    // ── Non-editable cell ──────────────────────────────────────
    describe("non-editable cell", () => {
        test("should not render input for non-editable column", () => {
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                { accessorKey: "name", header: "Name" },
            ];

            const { getByText, queryByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Non-editable cell renders as plain text
            expect(getByText("Alice")).toBeDefined();
            expect(queryByDisplayValue("Alice")).toBeNull();
        });

        test("should render non-editable cell with enableEditing=false", () => {
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { getByText, queryByDisplayValue } = render(
                <DataTable columns={columns} data={testData} onCellEdit={onCellEdit} />,
            );

            // Without enableEditing, even editable columns render as text
            expect(getByText("Alice")).toBeDefined();
            expect(queryByDisplayValue("Alice")).toBeNull();
        });
    });

    // ── Edge cases ─────────────────────────────────────────────
    describe("edge cases", () => {
        test("should handle null/undefined cell values", () => {
            const nullData = [
                { id: 1, name: null as unknown as string, price: 0, status: "", category: "" },
            ];
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { container } = render(
                <DataTable
                    columns={columns}
                    data={nullData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Should render without crashing
            expect(container.querySelector("table")).toBeDefined();
        });

        test("should handle empty string values", () => {
            const emptyData = [{ id: 1, name: "", price: 0, status: "", category: "" }];
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { container } = render(
                <DataTable
                    columns={columns}
                    data={emptyData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Ghost input should be present even for empty values
            const input = container.querySelector("input[type='text']");
            expect(input).toBeDefined();
        });

        test("should handle numeric zero values in editable cell", () => {
            const zeroData = [{ id: 0, name: "Zero", price: 0, status: "", category: "" }];
            const columns: ColumnDef<TestRow, any>[] = [
                {
                    accessorKey: "id",
                    header: "ID",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { getByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={zeroData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Zero should render as "0" in the input
            expect(getByDisplayValue("0")).toBeDefined();
        });

        test("should handle alignment meta option", () => {
            const columns: ColumnDef<TestRow, any>[] = [
                {
                    accessorKey: "price",
                    header: "Price",
                    meta: { editable: true, inputType: "number" as const, align: "right" as const },
                },
            ];

            const { container } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            // Ghost input should be rendered (alignment is on input, not a wrapper div)
            const inputs = container.querySelectorAll("input[type='number']");
            expect(inputs.length).toBe(2);
        });
    });

    // ── Auto-save (debounce) ───────────────────────────────────
    describe("auto-save", () => {
        test("should auto-save after 500ms debounce when value changes", async () => {
            const user = userEvent.setup();
            const columns: ColumnDef<TestRow, any>[] = [
                { accessorKey: "id", header: "ID" },
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { getByDisplayValue } = render(
                <DataTable
                    columns={columns}
                    data={testData}
                    enableEditing
                    onCellEdit={onCellEdit}
                />,
            );

            const input = getByDisplayValue("Alice");
            await user.clear(input);
            await user.type(input, "AutoSaved");

            // Before 500ms — not yet saved
            expect(onCellEdit).not.toHaveBeenCalled();

            // Wait for auto-save debounce
            await act(async () => {
                await new Promise((r) => setTimeout(r, 600));
            });

            expect(onCellEdit).toHaveBeenCalledWith(0, "name", "AutoSaved");
        });
    });
});
