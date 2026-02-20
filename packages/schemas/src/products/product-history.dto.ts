import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Operation } from "../common/enums";
import { ProductHistory } from "./product-history.model";

export const CreateInventoryAdjustmentBody = ProductHistory.pick({
    changeReason: true,
}).extend({
    operation: z.enum(["INVENTORY_ADD", "INVENTORY_REMOVE"]),
    quantity: z.number().positive(),
});

export const ProductHistoryPagination = PaginationQuery.extend({
    productId: z.coerce.number().optional(),
    operation: Operation.optional(),
    staffId: z.coerce.number().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
});

export type CreateInventoryAdjustmentBody = z.infer<typeof CreateInventoryAdjustmentBody>;
export type ProductHistoryPagination = z.infer<typeof ProductHistoryPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";
import type { AdminProductItem } from "./products.dto";

export interface HistoryEntryItem {
    id: number;
    productId: number;
    staffId: number | null;
    operation: string;
    quantity: number | null;
    previousData: unknown;
    newData: unknown;
    changeReason: string | null;
    createdAt: string;
    updatedAt: string;
    product?: { id: number; name: string; price?: number };
    staff?: { id: number; fullname: string } | null;
}

export type HistoryListResponse = ReturnSchema<{ count: number; history: HistoryEntryItem[] }>;
export type HistoryDetailResponse = ReturnSchema<HistoryEntryItem>;
export type InventoryAdjustmentResponse = ReturnSchema<{ product: AdminProductItem; historyEntry: HistoryEntryItem }>;
