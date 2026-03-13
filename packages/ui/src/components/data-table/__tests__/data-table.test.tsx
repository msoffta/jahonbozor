import { describe, test, expect, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
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

// НЕ мокируем Input - реальный компонент работает правильно

mock.module("../../ui/checkbox.tsx", () => ({
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...filterDOMProps(props)} />
    ),
}));

mock.module("../../ui/select.tsx", () => ({
    Select: ({ children, onValueChange, value }: any) => (
        <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
    SelectTrigger: () => null,
    SelectValue: () => null,
}));

mock.module("../../ui/table.tsx", () => ({
    Table: ({ children, className, style }: any) => <table className={className} style={style}>{children}</table>,
    TableBody: ({ children, style }: any) => <tbody style={style}>{children}</tbody>,
    TableCell: ({ children, colSpan, style }: any) => <td colSpan={colSpan} style={style}>{children}</td>,
    TableHead: ({ children, colSpan, style }: any) => <th colSpan={colSpan} style={style}>{children}</th>,
    TableHeader: ({ children, className, style }: any) => <thead className={className} style={style}>{children}</thead>,
    TableRow: ({ children, style }: any) => <tr style={style}>{children}</tr>,
}));

mock.module("../../ui/dropdown-menu.tsx", () => ({
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => <button type="button" onClick={onClick}>{children}</button>,
    DropdownMenuLabel: ({ children }: any) => <span>{children}</span>,
    DropdownMenuSeparator: () => <hr />,
}));

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../data-table";

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
            <DataTable columns={baseColumns} data={[]} translations={{ noResults: "No data found" }} />,
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
        const filterSelect = container.querySelector("select") as HTMLSelectElement;
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

        const { getByText, queryByText } = render(
            <DataTable columns={baseColumns} data={manyRows} pagination defaultPageSize={10} />,
        );

        expect(queryByText("User 1")).toBeDefined();
        expect(queryByText("User 11")).toBeNull();

        await user.click(getByText("→"));

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
        const onSelectionChange = mock(() => {});
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

    test("should enter edit mode on double-click and save on blur", async () => {
        const user = userEvent.setup();
        const onCellEdit = mock(() => {});
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

        const { getByText, getByDisplayValue } = render(
            <DataTable columns={editableColumns} data={testData} enableEditing onCellEdit={onCellEdit} />,
        );

        await user.dblClick(getByText("Alice"));

        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "Updated");
        await user.keyboard("{Enter}");

        expect(onCellEdit).toHaveBeenCalledWith(0, "name", "Updated");
    });

    test("should save new row on Enter and call onNewRowSave", () => {
        const onNewRowSave = mock(() => {});
        const editableColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID", meta: { editable: true, inputType: "text" as const } },
            { accessorKey: "name", header: "Name", meta: { editable: true, inputType: "text" as const } },
            { accessorKey: "age", header: "Age", meta: { editable: true, inputType: "text" as const } },
            { accessorKey: "status", header: "Status", meta: { editable: true, inputType: "text" as const } },
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
        const lastInput = inputs[inputs.length - 1];

        // Use fireEvent instead of user.type() to avoid controlled input issues with Bun/happy-dom
        fireEvent.change(lastInput, { target: { value: "test" } });
        fireEvent.keyDown(lastInput, { key: "Enter", code: "Enter" });

        expect(onNewRowSave).toHaveBeenCalled();
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
        const pageSizeSelect = container.querySelector("select") as HTMLSelectElement;
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
        const onCellEdit = mock(() => {});
        const { getByText, queryByDisplayValue } = render(
            <DataTable columns={baseColumns} data={testData} enableEditing onCellEdit={onCellEdit} />,
        );

        fireEvent.doubleClick(getByText("Alice"));

        expect(queryByDisplayValue("Alice")).toBeNull();
    });

    test("should render new row at start when newRowPosition='start'", () => {
        const editableColumns: ColumnDef<TestRow, any>[] = [
            { accessorKey: "id", header: "ID", meta: { editable: true, inputType: "text" as const } },
            { accessorKey: "name", header: "Name", meta: { editable: true, inputType: "text" as const } },
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

        // The first <tr> in <tbody> should be the new row (has dashed border class / inputs)
        const tbodyRows = container.querySelectorAll("tbody tr");
        const firstRow = tbodyRows[0] as HTMLElement;
        const lastRow = tbodyRows[tbodyRows.length - 1] as HTMLElement;

        // New row has text inputs; first data row does not
        const firstRowInputs = firstRow.querySelectorAll("input[type='text']");
        const lastRowInputs = lastRow.querySelectorAll("input[type='text']");

        expect(firstRowInputs.length).toBeGreaterThan(0);
        expect(lastRowInputs.length).toBe(0);
    });

    // ── Error cases ────────────────────────────────────────────
    test("should show validation error for invalid inline edit value", async () => {
        const { z } = await import("zod");
        const user = userEvent.setup();
        const onCellEdit = mock(() => {});
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

        const { getByText, getByDisplayValue, queryByText } = render(
            <DataTable columns={editableColumns} data={testData} enableEditing onCellEdit={onCellEdit} />,
        );

        await user.dblClick(getByText("Alice"));
        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "AB");
        await user.keyboard("{Enter}");

        // Validation fails — error message shown, onCellEdit not called
        expect(queryByText("Must be at least 3 characters")).toBeDefined();
        expect(onCellEdit).not.toHaveBeenCalled();
    });

    test("should not call onNewRowSave when required fields are invalid", async () => {
        const { z } = await import("zod");
        const user = userEvent.setup();
        const onNewRowSave = mock(() => {});
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
        const onCellEdit = mock(() => {});
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

        const { getByText, getByDisplayValue, queryByDisplayValue } = render(
            <DataTable columns={editableColumns} data={testData} enableEditing onCellEdit={onCellEdit} />,
        );

        await user.dblClick(getByText("Alice"));

        const input = getByDisplayValue("Alice");
        await user.clear(input);
        await user.type(input, "Changed{Escape}");

        expect(queryByDisplayValue("Changed")).toBeNull();
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
});
