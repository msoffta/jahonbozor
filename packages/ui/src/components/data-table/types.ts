import type { ColumnDef, RowData } from "@tanstack/react-table";

/** Structural type matching Zod's safeParse API (avoids coupling to zod version) */
export interface SafeParseable {
    safeParse(
        data: unknown,
    ):
        | { success: true; data: unknown }
        | { success: false; error: { issues: { message: string }[] } };
}

// ── Column Meta ────────────────────────────────────────────────
export interface DataTableColumnMeta {
    // Display
    align?: "left" | "center" | "right";
    className?: string; // applied to the inner cell content
    cellClassName?: string; // applied directly to the TableCell (td)
    headerClassName?: string; // applied directly to the TableHead (th)

    // Sizing — flex-like auto-fill (similar to MUI DataGrid flex)
    // Columns with flex distribute remaining container space proportionally.
    // Column `size` acts as the minimum width. Columns without flex stay fixed.
    flex?: number;

    // Filtering
    filterVariant?: "text" | "select" | "range";
    filterOptions?: { label: string; value: string }[];

    // Inline editing
    editable?: boolean;
    inputType?:
        | "text"
        | "number"
        | "select"
        | "combobox"
        | "date"
        | "datepicker"
        | "currency";
    selectOptions?: { label: string; value: string }[];
    validationSchema?: SafeParseable;
    placeholder?: string;

    // DatePicker — show time input (HH:mm) alongside calendar
    showTime?: boolean;
}

// ── TanStack module augmentation ───────────────────────────────
declare module "@tanstack/react-table" {
    interface ColumnMeta<
        TData extends RowData,
        TValue,
    > extends DataTableColumnMeta {}

    interface TableMeta<TData extends RowData> {
        updateData: (
            rowIndex: number,
            columnId: string,
            value: unknown,
        ) => void;
    }
}

// ── New Row State ──────────────────────────────────────────────
export interface NewRowState {
    id: string;
    values: Record<string, unknown>;
    errors: Record<string, string>;
}

// ── i18n ───────────────────────────────────────────────────────
export interface DataTableTranslations {
    search?: string;
    noResults?: string;
    columns?: string;
    rowsSelected?: string;
    page?: string;
    of?: string;
    rowsPerPage?: string;
    showAll?: string;
    previous?: string;
    next?: string;
    first?: string;
    last?: string;
    filterAll?: string;
    filterMin?: string;
    filterMax?: string;
    filter?: string;
}

// ── Props ──────────────────────────────────────────────────────
export interface DataTableProps<TData> {
    // Required
    columns: ColumnDef<TData, any>[];
    data: TData[];

    // Pagination
    pagination?: boolean;
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    enableShowAll?: boolean;

    // Features
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enableGlobalSearch?: boolean;
    enableColumnResizing?: boolean;
    enableColumnVisibility?: boolean;
    enableRowSelection?: boolean;

    // Editing
    enableEditing?: boolean;
    onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
    enableNewRow?: boolean;
    newRowPosition?: "start" | "end";
    onNewRowSave?: (data: Record<string, unknown>) => void;
    onNewRowChange?: (data: Record<string, unknown>) => void;
    newRowDefaultValues?: Partial<TData>;

    // Multi-row feature
    enableMultipleNewRows?: boolean;
    multiRowCount?: number;
    multiRowIncrement?: number;
    multiRowPosition?: "start" | "end";
    multiRowMaxCount?: number;
    onMultiRowSave?: (data: Record<string, unknown>, rowId: string) => void | Promise<void>;
    onMultiRowChange?: (data: Record<string, unknown>, rowId: string) => void | Record<string, unknown>;
    onMultiRowDelete?: (rowId: string) => void;
    multiRowDefaultValues?: Partial<TData> | ((rowIndex: number) => Partial<TData>);
    multiRowValidate?: (data: Record<string, unknown>) => boolean | string;

    // Callbacks
    onRowSelectionChange?: (selection: Record<string, boolean>) => void;
    onRowClick?: (row: TData) => void;

    // Styling
    className?: string;

    // i18n
    translations?: DataTableTranslations;
}
