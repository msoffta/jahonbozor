import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import {
    CategoriesPagination,
    CreateCategoryBody,
    UpdateCategoryBody,
} from "@jahonbozor/schemas/src/categories";

import { authMiddleware } from "@backend/lib/middleware";

import { CategoriesService } from "./categories.service";

import type {
    AdminCategoriesListResponse,
    AdminCategoryDetailResponse,
    AdminCategoryTreeResponse,
} from "@jahonbozor/schemas/src/categories";

const categoryIdParams = t.Object({
    id: t.Numeric(),
});

export const categories = new Elysia({ prefix: "/categories" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<AdminCategoriesListResponse> => {
            try {
                return await CategoriesService.getAllCategories(query, logger);
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
        "/tree",
        async ({ query, logger }): Promise<AdminCategoryTreeResponse> => {
            try {
                const depth = query.depth ?? 3;
                return await CategoriesService.getCategoryTree(depth, logger);
            } catch (error) {
                logger.error("Categories: Unhandled error in GET /categories/tree", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_LIST],
            query: t.Object({
                depth: t.Optional(t.Numeric({ minimum: 1, maximum: 5 })),
            }),
        },
    )
    .get(
        "/:id",
        async ({ params, query, set, logger }): Promise<AdminCategoryDetailResponse> => {
            try {
                const result = await CategoriesService.getCategory(
                    params.id,
                    query.includeChildren,
                    query.includeProducts,
                    query.includeParent,
                    query.depth,
                    logger,
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
        async ({ body, user, set, logger, requestId }): Promise<AdminCategoryDetailResponse> => {
            try {
                const result = await CategoriesService.createCategory(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

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
        async ({
            params,
            body,
            user,
            set,
            logger,
            requestId,
        }): Promise<AdminCategoryDetailResponse> => {
            try {
                const result = await CategoriesService.updateCategory(
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
        async ({ params, user, set, logger, requestId }): Promise<AdminCategoryDetailResponse> => {
            try {
                const result = await CategoriesService.deleteCategory(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_DELETE],
            params: categoryIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<AdminCategoryDetailResponse> => {
            try {
                const result = await CategoriesService.restoreCategory(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    const error = typeof result.error === "string" ? result.error : "";
                    if (error.includes("not found")) {
                        set.status = 404;
                    } else if (error.includes("not deleted")) {
                        set.status = 400;
                    } else {
                        set.status = 500;
                    }
                }

                return result;
            } catch (error) {
                logger.error("Categories: Unhandled error in POST /:id/restore", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.CATEGORIES_DELETE],
            params: categoryIdParams,
        },
    );
