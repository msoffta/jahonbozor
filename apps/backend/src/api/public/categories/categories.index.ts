import type { PublicCategoriesListResponse, PublicCategoryDetailResponse } from "@jahonbozor/schemas/src/categories";
import { requestContext } from "@backend/lib/request-context";
import { Elysia, t } from "elysia";
import { PublicCategoriesService } from "./categories.service";

const categoryIdParams = t.Object({
    id: t.Numeric(),
});

export const publicCategories = new Elysia({ prefix: "/categories" })
    .use(requestContext)
    .get(
        "/",
        async ({ logger }): Promise<PublicCategoriesListResponse> => {
            try {
                return await PublicCategoriesService.getAllCategories(logger);
            } catch (error) {
                logger.error("PublicCategories: Unhandled error in GET /categories", { error });
                return { success: false, error };
            }
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<PublicCategoryDetailResponse> => {
            try {
                const result = await PublicCategoriesService.getCategory(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("PublicCategories: Unhandled error in GET /categories/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        { params: categoryIdParams },
    );
