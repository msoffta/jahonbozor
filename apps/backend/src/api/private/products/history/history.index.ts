import { authMiddleware } from "@backend/lib/middleware";
import { Permission } from "@jahonbozor/schemas";
import type {
    HistoryDetailResponse,
    HistoryListResponse,
} from "@jahonbozor/schemas/src/products";
import { ProductHistoryPagination } from "@jahonbozor/schemas/src/products";
import { Elysia, t } from "elysia";
import { HistoryService } from "./history.service";

const historyIdParams = t.Object({
    historyId: t.Numeric(),
});

export const history = new Elysia()
    .use(authMiddleware)
    .get(
        "/history",
        async ({ query, logger }): Promise<HistoryListResponse> => {
            try {
                return await HistoryService.getAllHistory(query, logger);
            } catch (error) {
                logger.error("History: Unhandled error in GET /history", {
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_LIST],
            query: ProductHistoryPagination,
        },
    )
    .get(
        "/history/:historyId",
        async ({ params, set, logger }): Promise<HistoryDetailResponse> => {
            try {
                const result = await HistoryService.getHistoryEntry(
                    params.historyId,
                    logger,
                );

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error(
                    "History: Unhandled error in GET /history/:historyId",
                    { historyId: params.historyId, error },
                );
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_READ],
            params: historyIdParams,
        },
    );
