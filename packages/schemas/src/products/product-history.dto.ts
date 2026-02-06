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
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

export type CreateInventoryAdjustmentBody = z.infer<typeof CreateInventoryAdjustmentBody>;
export type ProductHistoryPagination = z.infer<typeof ProductHistoryPagination>;
