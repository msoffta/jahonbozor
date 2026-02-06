import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { ProductsPagination } from "@jahonbozor/schemas/src/products";
import { requestContext } from "@lib/request-context";
import { Elysia, t } from "elysia";
import { PublicProductsService } from "./products.service";

const productIdParams = t.Object({
    id: t.Numeric(),
});

export const publicProducts = new Elysia({ prefix: "/products" })
    .use(requestContext)
    .get(
        "/",
        async ({ query, logger }): Promise<ReturnSchema> => {
            try {
                return await PublicProductsService.getAllProducts(query, logger);
            } catch (error) {
                logger.error("Products: Unhandled error in GET /products", { error });
                return { success: false, error };
            }
        },
        { query: ProductsPagination },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<ReturnSchema> => {
            try {
                const result = await PublicProductsService.getProduct(params.id, logger);

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
