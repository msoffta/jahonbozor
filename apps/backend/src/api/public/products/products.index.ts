import { Elysia, t } from "elysia";

import { ProductsPagination } from "@jahonbozor/schemas/src/products";

import { requestContext } from "@backend/lib/request-context";

import { PublicProductsService } from "./products.service";

import type {
    PublicProductDetailResponse,
    PublicProductsListResponse,
} from "@jahonbozor/schemas/src/products";

const productIdParams = t.Object({
    id: t.Numeric(),
});

export const publicProducts = new Elysia({ prefix: "/products" })
    .use(requestContext)
    .get(
        "/",
        async ({ query, set, logger }): Promise<PublicProductsListResponse> => {
            try {
                return await PublicProductsService.getAllProducts(query, logger);
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { query: ProductsPagination },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<PublicProductDetailResponse> => {
            try {
                const result = await PublicProductsService.getProduct(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products/:id", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { params: productIdParams },
    );
