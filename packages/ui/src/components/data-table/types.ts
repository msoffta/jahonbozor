import type { ColumnDef, RowData } from "@tanstack/react-table";

/** Structural type matching Zod's safeParse API (avoids coupling to zod version) */
export interface SafeParseable {
    safeParse(data: unknown): { success: true; data: unknown } | { success: false; error: { issues: { message: string }[] } };
}

// ── Column Meta ────────────────────────────────────────────────
export interface DataTableColumnMeta {
    // Display
    align?: "left" | "center" | "right";
    className?: string;
    headerClassName?: string;

    // Sizing — flex-like auto-fill (similar to MUI DataGrid flex)
    // Columns with flex distribute remaining container space proportionally.
    // Column `size` acts as the minimum width. Columns without flex stay fixed.
    flex?: number;

    // Filtering
    filterVariant?: "text" | "select" | "range";
    filterOptions?: { label: string; value: string }[];

    // Inline editing
    editable?: boolean;
    inputType?: "text" | "number" | "select" | "combobox" | "date";
    selectOptions?: { label: string; value: string }[];
    validationSchema?: SafeParseable;
    placeholder?: string;
}

// ── TanStack module augmentation ───────────────────────────────
declare module "@tanstack/react-table" {
    interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta {}

    interface TableMeta<TData extends RowData> {
        updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    }
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
    newRowDefaultValues?: Partial<TData>;

    // Callbacks
    onRowSelectionChange?: (selection: Record<string, boolean>) => void;

    // Styling
    className?: string;

    // i18n
    translations?: DataTableTranslations;
}
