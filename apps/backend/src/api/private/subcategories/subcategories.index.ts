import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateSubcategoryBody,
    UpdateSubcategoryBody,
    SubcategoriesPagination,
} from "@jahonbozor/schemas/src/categories";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { SubcategoriesService } from "./subcategories.service";

const subcategoryIdParams = t.Object({
    id: t.Numeric(),
});

export const subcategories = new Elysia({ prefix: "/subcategories" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query: { page, limit, searchQuery, categoryId, includeCategory, includeProducts } }): Promise<ReturnSchema> => {
            try {
                return await SubcategoriesService.getAllSubcategories({
                    page,
                    limit,
                    searchQuery,
                    categoryId,
                    includeCategory,
                    includeProducts,
                });
            } catch (error) {
                logger.error("Subcategories: Unhandled error in GET /subcategories", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.SUBCATEGORIES_LIST],
            query: SubcategoriesPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, query, set }): Promise<ReturnSchema> => {
            try {
                const result = await SubcategoriesService.getSubcategory(
                    params.id,
                    query.includeCategory,
                    query.includeProducts,
                );

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Subcategories: Unhandled error in GET /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.SUBCATEGORIES_READ],
            params: subcategoryIdParams,
            query: SubcategoriesPagination,
        },
    )
    .post(
        "/",
        async ({ body, set }): Promise<ReturnSchema> => {
            try {
                const result = await SubcategoriesService.createSubcategory(body);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Subcategories: Unhandled error in POST /subcategories", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.SUBCATEGORIES_CREATE],
            body: CreateSubcategoryBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, set }): Promise<ReturnSchema> => {
            try {
                const result = await SubcategoriesService.updateSubcategory(params.id, body);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Subcategories: Unhandled error in PATCH /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.SUBCATEGORIES_UPDATE],
            params: subcategoryIdParams,
            body: UpdateSubcategoryBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, set }): Promise<ReturnSchema> => {
            try {
                const result = await SubcategoriesService.deleteSubcategory(params.id);

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Subcategories: Unhandled error in DELETE /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.SUBCATEGORIES_DELETE],
            params: subcategoryIdParams,
        },
    );
