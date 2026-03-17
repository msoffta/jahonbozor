import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Mock } from "vitest";

vi.mock("motion/react", async () => (await import("./test-helpers")).motionMock);
vi.mock("../../ui/button.tsx", async () => (await import("./test-helpers")).buttonMock);
vi.mock("../../ui/table.tsx", async () => (await import("./test-helpers")).tableMock);

import { DataTableNewRow } from "../data-table-new-row";

import type { ColumnDef } from "@tanstack/react-table";

// ── Test data ──────────────────────────────────────────────────
interface TestRow {
    id: number;
    name: string;
    value: number;
}

const baseColumns: ColumnDef<TestRow, any>[] = [
    { accessorKey: "id", header: "ID", meta: { editable: true, inputType: "text" as const } },
    { accessorKey: "name", header: "Name", meta: { editable: true, inputType: "text" as const } },
    {
        accessorKey: "value",
        header: "Value",
        meta: { editable: true, inputType: "number" as const },
    },
];

// ── Tests ──────────────────────────────────────────────────────
describe("DataTableNewRow", () => {
    let onSave: Mock;
    let onChange: Mock;

    beforeEach(() => {
        onSave = vi.fn();
        onChange = vi.fn();
    });

    // ── Uncontrolled mode (existing behavior) ──────────────────
    describe("Uncontrolled mode", () => {
        test("should render with default values", () => {
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            columns={baseColumns}
                            onSave={onSave}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const row = container.querySelector("tr");
            expect(row).toBeDefined();
            const inputs = row?.querySelectorAll("input");
            expect(inputs?.length).toBeGreaterThan(0);
        });

        test("should call onChange when input value changes", () => {
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            columns={baseColumns}
                            onSave={onSave}
                            onChange={onChange}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1];

            // Use fireEvent instead of user.type() to avoid controlled input issues with Bun/happy-dom
            fireEvent.change(nameInput, { target: { value: "Test" } });

            // Check that input value is updated correctly
            expect(nameInput.value).toBe("Test");
            // onChange should have been called
            expect(onChange).toHaveBeenCalled();
        });

        test("should call onSave when Enter is pressed on last field", async () => {
            const user = userEvent.setup();
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            columns={baseColumns}
                            onSave={onSave}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const inputs = container.querySelectorAll("input");
            const lastInput = inputs[inputs.length - 1];

            lastInput.focus();
            await user.keyboard("{Enter}");

            expect(onSave).toHaveBeenCalled();
        });

        test("should maintain internal state when not controlled", () => {
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            columns={baseColumns}
                            onSave={onSave}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1];

            // Use fireEvent instead of user.type() to avoid controlled input issues with Bun/happy-dom
            fireEvent.change(nameInput, { target: { value: "Internal" } });

            expect(nameInput.value).toBe("Internal");
        });
    });

    // ── Controlled mode (new) ──────────────────────────────────
    describe("Controlled mode", () => {
        test("should call onChange when typing in controlled mode", async () => {
            const user = userEvent.setup();
            const externalValues = { id: 1, name: "External", value: 50 };

            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            id="controlled-row"
                            columns={baseColumns}
                            onSave={onSave}
                            onChange={onChange}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                            externalValues={externalValues}
                        />
                    </tbody>
                </table>,
            );

            const inputs = container.querySelectorAll("input");
            const nameInput = inputs[1];

            await user.clear(nameInput);
            await user.type(nameInput, "NewValue");

            // onChange should be called (controlled mode calls onChange directly via setValues)
            expect(onChange).toHaveBeenCalled();
        });

        test("should display external errors", () => {
            const externalValues = { id: 1, name: "", value: 0 };
            const externalErrors = { name: "Name is required" };

            const { getByText } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            id="error-row"
                            columns={baseColumns}
                            onSave={onSave}
                            onChange={onChange}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                            externalValues={externalValues}
                            externalErrors={externalErrors}
                        />
                    </tbody>
                </table>,
            );

            expect(getByText("Name is required")).toBeDefined();
        });

        test("should preserve controlled errors on save attempt", async () => {
            const user = userEvent.setup();
            const externalValues = { id: 0, name: "", value: 0 };
            const externalErrors = { name: "Invalid name" };

            const { container, getByText } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            id="preserve-error-row"
                            columns={baseColumns}
                            onSave={onSave}
                            onChange={onChange}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                            externalValues={externalValues}
                            externalErrors={externalErrors}
                        />
                    </tbody>
                </table>,
            );

            // Error should be visible
            expect(getByText("Invalid name")).toBeDefined();

            // Try to save via Enter on last input
            const inputs = container.querySelectorAll("input");
            const lastInput = inputs[inputs.length - 1];
            lastInput.focus();
            await user.keyboard("{Enter}");

            // Error should still be visible (parent controls errors)
            expect(getByText("Invalid name")).toBeDefined();
        });

        test("should use custom id when provided", () => {
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            id="custom-id-row"
                            columns={baseColumns}
                            onSave={onSave}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const row = container.querySelector("tr");
            expect(row?.id).toBe("custom-id-row");
        });

        test("should default to 'new-row' id when not provided", () => {
            const { container } = render(
                <table>
                    <tbody>
                        <DataTableNewRow
                            columns={baseColumns}
                            onSave={onSave}
                            defaultValues={{ id: 0, name: "", value: 0 }}
                        />
                    </tbody>
                </table>,
            );

            const row = container.querySelector("tr");
            expect(row?.id).toBe("new-row");
        });
    });

    // ── Edge cases ─────────────────────────────────────────────
    test("should handle empty externalValues object", () => {
        const { container } = render(
            <table>
                <tbody>
                    <DataTableNewRow
                        id="empty-external"
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                        externalValues={{}}
                    />
                </tbody>
            </table>,
        );

        const row = container.querySelector("tr");
        expect(row).toBeDefined();
    });

    test("should handle undefined externalErrors", () => {
        const { container } = render(
            <table>
                <tbody>
                    <DataTableNewRow
                        id="no-errors"
                        columns={baseColumns}
                        onSave={onSave}
                        onChange={onChange}
                        defaultValues={{ id: 0, name: "", value: 0 }}
                        externalValues={{ id: 1, name: "Test", value: 10 }}
                        externalErrors={undefined}
                    />
                </tbody>
            </table>,
        );

        const row = container.querySelector("tr");
        expect(row).toBeDefined();
    });
});
