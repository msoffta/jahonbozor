import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import { ProductHistoryPagination } from "@jahonbozor/schemas/src/products";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { HistoryService } from "./history.service";

const historyIdParams = t.Object({
    historyId: t.Numeric(),
});

export const history = new Elysia({ prefix: "/history" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<ReturnSchema> => {
            try {
                return await HistoryService.getAllHistory(query, logger);
            } catch (error) {
                logger.error("History: Unhandled error in GET /history", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_LIST],
            query: ProductHistoryPagination,
        },
    )
    .get(
        "/:historyId",
        async ({ params, set, logger }): Promise<ReturnSchema> => {
            try {
                const result = await HistoryService.getHistoryEntry(params.historyId, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("History: Unhandled error in GET /history/:historyId", { historyId: params.historyId, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_READ],
            params: historyIdParams,
        },
    );
