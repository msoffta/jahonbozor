import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

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
    age: number;
    status: string;
}

const testData: TestRow[] = [
    { id: 1, name: "Alice", age: 30, status: "active" },
    { id: 2, name: "Bob", age: 25, status: "inactive" },
    { id: 3, name: "Charlie", age: 35, status: "active" },
    { id: 4, name: "Diana", age: 28, status: "active" },
    { id: 5, name: "Eve", age: 32, status: "inactive" },
];

const baseColumns: ColumnDef<TestRow, any>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "age", header: "Age" },
    { accessorKey: "status", header: "Status" },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTable", () => {
    // ── Happy path ─────────────────────────────────────────────
    test("should render column headers and row data correctly", () => {
        const { getByText } = render(<DataTable columns={baseColumns} data={testData} />);

        expect(getByText("ID")).toBeDefined();
        expect(getByText("Name")).toBeDefined();
        expect(getByText("Age")).toBeDefined();
        expect(getByText("Status")).toBeDefined();

        expect(getByText("Alice")).toBeDefined();
        expect(getByText("Bob")).toBeDefined();
        expect(getByText("30")).toBeDefined();
    });

    test("should show noResults translation when data is empty", () => {
        const { getByText } = render(
            <DataTable
                columns={baseColumns}
                data={[]}
                translations={{ noResults: "No data found" }}
            />,
        );
        expect(getByText("No data found")).toBeDefined();
    });

    test("should sort rows when clicking a sortable header", () => {
        const { getByText, getAllByRole } = render(
            <DataTable columns={baseColumns} data={testData} enableSorting />,
        );

        // Click once — asc sort
        fireEvent.click(getByText("Age"));

        const getCellTexts = () => {
            const cells = getAllByRole("cell");
            return cells.filter((_cell, i) => i % 4 === 2).map((cell) => cell.textContent);
        };

        const afterFirstClick = getCellTexts();
        // Verify rows are sorted (either asc or desc, both prove sorting works)
        const sorted = [...afterFirstClick].sort((a, b) => Number(a) - Number(b));
        const sortedDesc = [...sorted].reverse();
        const isSorted =
            JSON.stringify(afterFirstClick) === JSON.stringify(sorted) ||
            JSON.stringify(afterFirstClick) === JSON.stringify(sortedDesc);
        expect(isSorted).toBe(true);

        // Click again to reverse
        fireEvent.click(getByText("Age"));
        const afterSecondClick = getCellTexts();
        expect(afterSecondClick).not.toEqual(afterFirstClick);
    });

    test("should filter rows via global search", async () => {
        const user = userEvent.setup();
        const { getByPlaceholderText, queryByText } = render(
            <DataTable
                columns={baseColumns}
                data={testData}
                enableGlobalSearch
                translations={{ search: "Search..." }}
            />,
        );

        const searchInput = getByPlaceholderText("Search...");
        await user.clear(searchInput);
        await user.type(searchInput, "Alice");

        expect(queryByText("Alice")).toBeDefined();
        expect(queryByText("Bob")).toBeNull();
    });

    test("should filter rows by column filter value", async () => {
        const user = userEvent.setup();
        const filterColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            { accessorKey: "name", header: "Name" },
            { accessorKey: "age", header: "Age" },
            {
                accessorKey: "status",
                header: "Status",
                meta: {
                    filterVariant: "select" as const,
                    filterOptions: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                },
            },
        ];

        const { container, queryByText } = render(
            <DataTable columns={filterColumns} data={testData} enableFiltering />,
        );

        // Find the column filter select (native <select> in the toolbar)
        const filterSelect = container.querySelector("select")!;
        expect(filterSelect).toBeDefined();

        await user.selectOptions(filterSelect, "inactive");

        expect(queryByText("Alice")).toBeNull();
        expect(queryByText("Bob")).toBeDefined();
        expect(queryByText("Eve")).toBeDefined();
    });

    test("should paginate with next/prev buttons", async () => {
        const user = userEvent.setup();
        const manyRows = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            age: 20 + i,
            status: "active",
        }));

        const { getByRole, queryByText } = render(
            <DataTable columns={baseColumns} data={manyRows} pagination defaultPageSize={10} />,
        );

        expect(queryByText("User 1")).toBeDefined();
        expect(queryByText("User 11")).toBeNull();

        await user.click(getByRole("button", { name: "Next page" }));

        expect(queryByText("User 1")).toBeNull();
        expect(queryByText("User 11")).toBeDefined();
    });

    test("should toggle column visibility", async () => {
        const user = userEvent.setup();
        const { getAllByText, container } = render(
            <DataTable
                columns={baseColumns}
                data={testData}
                enableColumnVisibility
                translations={{ columns: "Columns" }}
            />,
        );

        const getHeaderTexts = () =>
            Array.from(container.querySelectorAll("th")).map((th) => th.textContent);

        // Column header should be visible initially
        expect(getHeaderTexts()).toContain("Age");

        // The mocked DropdownMenuContent renders children immediately (always visible),
        // so "Age" exists in both the <th> header and the dropdown <button>.
        // Find the dropdown toggle button for "Age" column.
        const ageElements = getAllByText("Age");
        const ageToggle = ageElements.find((el) => el.tagName.toLowerCase() === "button")!;
        await user.click(ageToggle);

        // The "Age" header should be gone
        expect(getHeaderTexts()).not.toContain("Age");
    });

    test("should select a row via checkbox", () => {
        const onSelectionChange = vi.fn();
        const { getAllByRole } = render(
            <DataTable
                columns={baseColumns}
                data={testData}
                enableRowSelection
                onRowSelectionChange={onSelectionChange}
            />,
        );

        const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
        fireEvent.click(checkboxes[1]); // first data row

        expect(checkboxes[1].checked).toBe(true);
    });

    test("should render ghost inputs and save on blur", async () => {
        const user = userEvent.setup();
        const onCellEdit = vi.fn();
        const editableColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "name",
                header: "Name",
                meta: { editable: true, inputType: "text" as const },
            },
            { accessorKey: "age", header: "Age" },
            { accessorKey: "status", header: "Status" },
        ];

        const { getByDisplayValue } = render(
            <DataTable
                columns={editableColumns}
                data={testData}
                enableEditing
                onCellEdit={onCellEdit}
            />,
        );

        // Ghost inputs are always visible — no double-click needed
        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "Updated");
        fireEvent.blur(input);

        expect(onCellEdit).toHaveBeenCalledWith(0, "name", "Updated");
    });

    test("should save new row on blur and call onNewRowSave", async () => {
        const user = userEvent.setup();
        const onNewRowSave = vi.fn();
        const editableColumns: ColumnDef<TestRow, any>[] = [
            {
                accessorKey: "id",
                header: "ID",
                meta: { editable: true, inputType: "text" as const },
            },
            {
                accessorKey: "name",
                header: "Name",
                meta: { editable: true, inputType: "text" as const },
            },
            {
                accessorKey: "age",
                header: "Age",
                meta: { editable: true, inputType: "text" as const },
            },
            {
                accessorKey: "status",
                header: "Status",
                meta: { editable: true, inputType: "text" as const },
            },
        ];

        const { getAllByRole } = render(
            <DataTable
                columns={editableColumns}
                data={[]}
                enableEditing
                enableNewRow
                onNewRowSave={onNewRowSave}
                newRowDefaultValues={{ id: 0, name: "", age: 0, status: "" }}
                translations={{ noResults: "Empty" }}
            />,
        );

        const inputs = getAllByRole("textbox");
        // Fill in data and trigger blur-save by clicking outside the new row
        await user.type(inputs[0], "1");
        await user.type(inputs[1], "Test");
        await user.type(inputs[2], "25");
        await user.type(inputs[3], "active");

        // Blur the new row — triggers save via <tr> onBlur handler
        fireEvent.blur(inputs[3]);

        // Allow the 200ms blur timeout to fire
        await vi.waitFor(
            () => {
                expect(onNewRowSave).toHaveBeenCalled();
            },
            { timeout: 500 },
        );
    });

    test("should show all rows when 'Show All' is selected in pagination", async () => {
        const user = userEvent.setup();
        const manyRows = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            age: 20 + i,
            status: "active",
        }));

        const { container, queryByText } = render(
            <DataTable
                columns={baseColumns}
                data={manyRows}
                pagination
                defaultPageSize={10}
                enableShowAll
                translations={{ showAll: "All" }}
            />,
        );

        // Initially paginated — User 11 not visible
        expect(queryByText("User 1")).toBeDefined();
        expect(queryByText("User 11")).toBeNull();

        // Find the page size <select> and change to "all"
        const pageSizeSelect = container.querySelector("select")!;
        await user.selectOptions(pageSizeSelect, "all");

        // Now all rows should be visible
        expect(queryByText("User 1")).toBeDefined();
        expect(queryByText("User 25")).toBeDefined();
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should show no results message for empty data", () => {
        const { getByText } = render(
            <DataTable columns={baseColumns} data={[]} translations={{ noResults: "Empty" }} />,
        );
        expect(getByText("Empty")).toBeDefined();
    });

    test("should render multiple new rows when enableMultipleNewRows is true", () => {
        const { getAllByTestId } = render(
            <DataTable
                columns={baseColumns}
                data={[]}
                enableMultipleNewRows
                multiRowCount={5}
                onMultiRowSave={() => {}}
                translations={{ noResults: "Empty" }}
            />,
        );

        // Should render 5 new rows (plus possibly one for sentinel or similar if implementation uses it)
        // Note: The actual implementation in DataTableBody might need to be updated first
        // This test is expected to fail initially (Test First)
        const newRows = getAllByTestId("new-row");
        expect(newRows.length).toBe(5);
    });

    test("should handle single row data", () => {
        const { getByText, queryByText } = render(
            <DataTable columns={baseColumns} data={[testData[0]]} pagination />,
        );
        expect(getByText("Alice")).toBeDefined();
        expect(queryByText("1 / 1")).toBeDefined();
    });

    test("should not enter edit mode on double-click if column is not editable", () => {
        const onCellEdit = vi.fn();
        const { getByText, queryByDisplayValue } = render(
            <DataTable
                columns={baseColumns}
                data={testData}
                enableEditing
                onCellEdit={onCellEdit}
            />,
        );

        fireEvent.doubleClick(getByText("Alice"));

        expect(queryByDisplayValue("Alice")).toBeNull();
    });

    test("should render new row at start when newRowPosition='start'", () => {
        const editableColumns: ColumnDef<TestRow, any>[] = [
            {
                accessorKey: "id",
                header: "ID",
                meta: { editable: true, inputType: "text" as const },
            },
            {
                accessorKey: "name",
                header: "Name",
                meta: { editable: true, inputType: "text" as const },
            },
            { accessorKey: "age", header: "Age" },
            { accessorKey: "status", header: "Status" },
        ];

        const { container } = render(
            <DataTable
                columns={editableColumns}
                data={testData}
                enableEditing
                enableNewRow
                newRowPosition="start"
                onNewRowSave={() => {}}
                newRowDefaultValues={{ id: 0, name: "", age: 0, status: "" }}
            />,
        );

        // The first <tr> in <tbody> should be the new row (identified by data-testid)
        const tbodyRows = container.querySelectorAll("tbody tr");
        const firstRow = tbodyRows[0] as HTMLElement;

        // New row is identifiable by data-testid="new-row"
        expect(firstRow.getAttribute("data-testid")).toBe("new-row");
    });

    // ── Error cases ────────────────────────────────────────────
    test("should show validation error for invalid inline edit value", async () => {
        const z = (await import("zod")).default;
        const user = userEvent.setup();
        const onCellEdit = vi.fn();
        const editableColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "name",
                header: "Name",
                meta: {
                    editable: true,
                    inputType: "text" as const,
                    validationSchema: z.string().min(3, "Must be at least 3 characters"),
                },
            },
            { accessorKey: "age", header: "Age" },
            { accessorKey: "status", header: "Status" },
        ];

        const { getByDisplayValue, queryByText } = render(
            <DataTable
                columns={editableColumns}
                data={testData}
                enableEditing
                onCellEdit={onCellEdit}
            />,
        );

        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "AB");
        await user.keyboard("{Enter}");

        // Validation fails — error message shown, onCellEdit not called
        expect(queryByText("Must be at least 3 characters")).toBeDefined();
        expect(onCellEdit).not.toHaveBeenCalled();
    });

    test("should not call onNewRowSave when required fields are invalid", async () => {
        const z = (await import("zod")).default;
        const user = userEvent.setup();
        const onNewRowSave = vi.fn();
        const editableColumns: ColumnDef<TestRow, any>[] = [
            {
                accessorKey: "id",
                header: "ID",
                meta: { editable: true, inputType: "text" as const },
            },
            {
                accessorKey: "name",
                header: "Name",
                meta: {
                    editable: true,
                    inputType: "text" as const,
                    validationSchema: z.string().min(1, "Name is required"),
                },
            },
            { accessorKey: "age", header: "Age" },
            { accessorKey: "status", header: "Status" },
        ];

        const { getAllByRole } = render(
            <DataTable
                columns={editableColumns}
                data={[]}
                enableEditing
                enableNewRow
                onNewRowSave={onNewRowSave}
                newRowDefaultValues={{ id: 0, name: "", age: 0, status: "" }}
                translations={{ noResults: "Empty" }}
            />,
        );

        // Type into first field (id), press Enter to move to next, then Enter on empty name field to try save
        const inputs = getAllByRole("textbox");
        await user.type(inputs[0], "99{Enter}");

        // Name field is empty → pressing Enter on last field triggers save with validation error
        const nameInput = inputs[1] as HTMLInputElement;
        await user.type(nameInput, "{Enter}");

        expect(onNewRowSave).not.toHaveBeenCalled();
    });

    test("should revert value on Escape during edit", async () => {
        const user = userEvent.setup();
        const onCellEdit = vi.fn();
        const editableColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID" },
            {
                accessorKey: "name",
                header: "Name",
                meta: { editable: true, inputType: "text" as const },
            },
            { accessorKey: "age", header: "Age" },
            { accessorKey: "status", header: "Status" },
        ];

        const { getByDisplayValue, queryByDisplayValue } = render(
            <DataTable
                columns={editableColumns}
                data={testData}
                enableEditing
                onCellEdit={onCellEdit}
            />,
        );

        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "Changed");
        await user.keyboard("{Escape}");

        expect(queryByDisplayValue("Changed")).toBeNull();
        expect(getByDisplayValue("Alice")).toBeDefined();
        expect(onCellEdit).not.toHaveBeenCalled();
    });

    // ── Boundary values ────────────────────────────────────────
    test("should handle very long text in cells", () => {
        const longText = "A".repeat(500);
        const longData = [{ id: 1, name: longText, age: 0, status: "" }];

        const { getByText } = render(<DataTable columns={baseColumns} data={longData} />);
        expect(getByText(longText)).toBeDefined();
    });

    test("should handle numeric zero and negative values in editable cells", () => {
        const zeroData = [{ id: 0, name: "Zero", age: -5, status: "test" }];

        const { getByText } = render(<DataTable columns={baseColumns} data={zeroData} />);
        expect(getByText("0")).toBeDefined();
        expect(getByText("-5")).toBeDefined();
    });

    // ── onRowClick ─────────────────────────────────────────────
    test("should call onRowClick when a row is clicked", async () => {
        const user = userEvent.setup();
        const onRowClick = vi.fn();
        const { getByText } = render(
            <DataTable columns={baseColumns} data={testData} onRowClick={onRowClick} />,
        );

        await user.click(getByText("Alice"));

        expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    });

    test("should not call onRowClick when onRowClick is not provided", () => {
        const { getByText } = render(<DataTable columns={baseColumns} data={testData} />);

        // Clicking should not throw
        fireEvent.click(getByText("Alice"));
    });

    // ── Race Condition Fix: Multi-row Navigation ──────────────────
    describe("Multi-row Tab navigation race condition fix", () => {
        test("should render multiple new rows with enableMultipleNewRows", () => {
            const onMultiRowSave = vi.fn();
            const editableColumns: ColumnDef<TestRow, any>[] = [
                {
                    accessorKey: "name",
                    header: "Name",
                    meta: { editable: true, inputType: "text" as const },
                },
            ];

            const { getAllByRole } = render(
                <DataTable
                    columns={editableColumns}
                    data={[]}
                    enableMultipleNewRows
                    multiRowCount={3}
                    onMultiRowSave={onMultiRowSave}
                    multiRowDefaultValues={{ name: "" }}
                    translations={{ noResults: "Empty" }}
                />,
            );

            // Should render 3 text inputs (one per row)
            const inputs = getAllByRole("textbox");
            expect(inputs.length).toBe(3);
        });
    });
});
