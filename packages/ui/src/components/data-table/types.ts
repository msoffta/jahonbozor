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

    // Drag-to-select sum
    enableDragSum?: boolean;

    // Inline editing
    editable?: boolean;
    inputType?: "text" | "number" | "select" | "combobox" | "date" | "datepicker" | "currency";
    selectOptions?: { label: string; value: string }[];
    validationSchema?: SafeParseable;
    placeholder?: string;
    /** Override cell.getValue() when entering edit mode (e.g. return productId instead of product name) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- row type varies per table
    editValueAccessor?: (row: any) => unknown;
    /** Async search for combobox options — called with debounce when user types */
    onSearchOptions?: (query: string) => Promise<{ label: string; value: string }[]>;

    // DatePicker — show time input (HH:mm) alongside calendar
    showTime?: boolean;
}

// ── TanStack module augmentation ───────────────────────────────
declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation requires matching generic params
    interface ColumnMeta<
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- module augmentation requires matching generic params
        TData extends RowData,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- module augmentation requires matching generic params
        TValue,
    > extends DataTableColumnMeta {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- module augmentation requires matching generic params
    interface TableMeta<TData extends RowData> {
        updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    }
}

// ── New Row State ──────────────────────────────────────────────
export interface NewRowState {
    id: string;
    values: Record<string, unknown>;
    errors: Record<string, string>;
    linkedId?: unknown;
    isSaving?: boolean;
    lastSavedValues?: Record<string, unknown>;
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
    sumLabel?: string;

    // Infinite scroll
    showingOf?: string;
    loadingMore?: string;
}

// ── Ref handle ────────────────────────────────────────────────
export interface DataTableRef {
    /** Save all non-empty, changed new rows that haven't been committed yet */
    flushPendingRows: () => Promise<void>;
}

// ── Props ──────────────────────────────────────────────────────
export interface DataTableProps<TData> {
    // Required
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table ColumnDef requires `any` for heterogeneous column value types
    columns: ColumnDef<TData, any>[];
    data: TData[];

    // Pagination
    pagination?: boolean;
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    enableShowAll?: boolean;
    manualPagination?: boolean;
    pageCount?: number;
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;

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
    onMultiRowSave?: (
        data: Record<string, unknown>,
        rowId: string,
        linkedId?: unknown,
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: documents that callback may return sync or async
    ) => unknown | Promise<unknown>;
    onMultiRowChange?: (
        data: Record<string, unknown>,
        rowId: string,
    ) => void | Record<string, unknown>;
    multiRowDefaultValues?: Partial<TData> | ((rowIndex: number) => Partial<TData>);
    multiRowValidate?: (data: Record<string, unknown>) => boolean | string;

    // Infinite scroll
    enableInfiniteScroll?: boolean;
    onFetchNextPage?: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    totalCount?: number;

    // Server-side search — when provided, search query is sent to the server
    // instead of filtering client-side. The parent manages the query state.
    onSearchQueryChange?: (query: string) => void;

    // Callbacks
    onRowSelectionChange?: (selection: Record<string, boolean>) => void;
    onRowClick?: (row: TData) => void;
    onDragSelectionChange?: (selectedRows: TData[]) => void;

    // Column visibility
    initialColumnVisibility?: Record<string, boolean>;

    // Loading state — show spinner on specific rows (e.g. during update/delete)
    loadingRowIds?: Set<number>;

    // Styling
    className?: string;

    // i18n
    translations?: DataTableTranslations;
}
