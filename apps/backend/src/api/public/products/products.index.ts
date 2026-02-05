import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { ProductsPagination } from "@jahonbozor/schemas/src/products";
import logger from "@lib/logger";
import { Elysia, t } from "elysia";
import { PublicProductsService } from "./products.service";

const productIdParams = t.Object({
    id: t.Numeric(),
});

export const publicProducts = new Elysia({ prefix: "/products" })
    .get(
        "/",
        async ({ query }): Promise<ReturnSchema> => {
            try {
                return await PublicProductsService.getAllProducts(query);
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products", { error });
                return { success: false, error };
            }
        },
        { query: ProductsPagination },
    )
    .get(
        "/:id",
        async ({ params, set }): Promise<ReturnSchema> => {
            try {
                const result = await PublicProductsService.getProduct(params.id);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        { params: productIdParams },
    );
