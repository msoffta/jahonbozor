import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateInventoryAdjustmentBody,
    ProductHistoryPagination,
} from "@jahonbozor/schemas/src/product-history";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { ProductHistoryService } from "./product-history.service";

const historyIdParams = t.Object({
    id: t.Numeric(),
});

export const productHistory = new Elysia({ prefix: "/product-history" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query }): Promise<ReturnSchema> => {
            try {
                return await ProductHistoryService.getAllHistory(query);
            } catch (error) {
                logger.error("ProductHistory: Unhandled error in GET /product-history", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_LIST],
            query: ProductHistoryPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductHistoryService.getHistoryEntry(params.id);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("ProductHistory: Unhandled error in GET /product-history/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_READ],
            params: historyIdParams,
        },
    )
    .post(
        "/inventory",
        async ({ body, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductHistoryService.createInventoryAdjustment(body, user.id);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("ProductHistory: Unhandled error in POST /product-history/inventory", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_CREATE],
            body: CreateInventoryAdjustmentBody,
        },
    );
