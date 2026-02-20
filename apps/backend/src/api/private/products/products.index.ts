import type {
    AdminProductsListResponse,
    AdminProductDetailResponse,
    HistoryListResponse,
    InventoryAdjustmentResponse,
} from "@jahonbozor/schemas/src/products";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateProductBody,
    UpdateProductBody,
    ProductsPagination,
    CreateInventoryAdjustmentBody,
    ProductHistoryPagination,
} from "@jahonbozor/schemas/src/products";
import { authMiddleware } from "@backend/lib/middleware";
import { Elysia, t } from "elysia";
import { ProductsService } from "./products.service";
import { HistoryService } from "./history/history.service";
import { history } from "./history/history.index";

const productIdParams = t.Object({
    id: t.Numeric(),
});

export const products = new Elysia({ prefix: "/products" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<AdminProductsListResponse> => {
            try {
                return await ProductsService.getAllProducts(query, logger);
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_LIST],
            query: ProductsPagination,
        },
    )
    .use(history)
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<AdminProductDetailResponse> => {
            try {
                const result = await ProductsService.getProduct(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_READ],
            params: productIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set, logger, requestId }): Promise<AdminProductDetailResponse> => {
            try {
                const result = await ProductsService.createProduct(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in POST /products", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_CREATE],
            body: CreateProductBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, user, set, logger, requestId }): Promise<AdminProductDetailResponse> => {
            try {
                const result = await ProductsService.updateProduct(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in PATCH /products/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_UPDATE],
            params: productIdParams,
            body: UpdateProductBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<AdminProductDetailResponse> => {
            try {
                const result = await ProductsService.deleteProduct(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in DELETE /products/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_DELETE],
            params: productIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<AdminProductDetailResponse> => {
            try {
                const result = await ProductsService.restoreProduct(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in POST /products/:id/restore", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCTS_UPDATE],
            params: productIdParams,
        },
    )
    .get(
        "/:id/history",
        async ({ params, query, logger }): Promise<HistoryListResponse> => {
            try {
                return await HistoryService.getProductHistory(params.id, query, logger);
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products/:id/history", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_LIST],
            params: productIdParams,
            query: ProductHistoryPagination,
        },
    )
    .post(
        "/:id/inventory",
        async ({ params, body, user, set, logger, requestId }): Promise<InventoryAdjustmentResponse> => {
            try {
                const result = await HistoryService.createInventoryAdjustment(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in POST /products/:id/inventory", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.PRODUCT_HISTORY_CREATE],
            params: productIdParams,
            body: CreateInventoryAdjustmentBody,
        },
    );
