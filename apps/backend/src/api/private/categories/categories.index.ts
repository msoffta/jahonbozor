import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateCategoryBody,
    UpdateCategoryBody,
    CategoriesPagination,
} from "@jahonbozor/schemas/src/categories";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { CategoriesService } from "./categories.service";

const categoryIdParams = t.Object({
    id: t.Numeric(),
});

export const categories = new Elysia({ prefix: "/categories" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query: { page, limit, searchQuery, includeSubcategories, includeProducts } }): Promise<ReturnSchema> => {
            try {
                return await CategoriesService.getAllCategories({
                    page,
                    limit,
                    searchQuery,
                    includeSubcategories,
                    includeProducts,
                });
            } catch (error) {
                logger.error("Categories: Unhandled error in GET /categories", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_LIST],
            query: CategoriesPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, query, set }): Promise<ReturnSchema> => {
            try {
                const result = await CategoriesService.getCategory(
                    params.id,
                    query.includeSubcategories,
                    query.includeProducts,
                );

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in GET /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_READ],
            params: categoryIdParams,
            query: CategoriesPagination,
        },
    )
    .post(
        "/",
        async ({ body, set }): Promise<ReturnSchema> => {
            try {
                const result = await CategoriesService.createCategory(body);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in POST /categories", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_CREATE],
            body: CreateCategoryBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, set }): Promise<ReturnSchema> => {
            try {
                const result = await CategoriesService.updateCategory(params.id, body);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in PATCH /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_UPDATE],
            params: categoryIdParams,
            body: UpdateCategoryBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, set }): Promise<ReturnSchema> => {
            try {
                const result = await CategoriesService.deleteCategory(params.id);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in DELETE /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_DELETE],
            params: categoryIdParams,
        },
    );
