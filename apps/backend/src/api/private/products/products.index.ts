import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateProductBody,
    UpdateProductBody,
    ProductsPagination,
} from "@jahonbozor/schemas/src/products";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { ProductsService } from "./products.service";

const productIdParams = t.Object({
    id: t.Numeric(),
});

export const products = new Elysia({ prefix: "/products" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query }): Promise<ReturnSchema> => {
            try {
                return await ProductsService.getAllProducts(query);
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
    .get(
        "/:id",
        async ({ params, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductsService.getProduct(params.id);

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
        async ({ body, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductsService.createProduct(body, user.id);

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
        async ({ params, body, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductsService.updateProduct(params.id, body, user.id);

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
        async ({ params, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductsService.deleteProduct(params.id, user.id);

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
        async ({ params, user, set }): Promise<ReturnSchema> => {
            try {
                const result = await ProductsService.restoreProduct(params.id, user.id);

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
    );
