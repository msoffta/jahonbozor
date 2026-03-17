import { Elysia, t } from "elysia";

import { requestContext } from "@backend/lib/request-context";

import { PublicCategoriesService } from "./categories.service";

import type {
    PublicCategoriesListResponse,
    PublicCategoryDetailResponse,
} from "@jahonbozor/schemas/src/categories";

const categoryIdParams = t.Object({
    id: t.Numeric(),
});

export const publicCategories = new Elysia({ prefix: "/categories" })
    .use(requestContext)
    .get("/", async ({ set, logger }): Promise<PublicCategoriesListResponse> => {
        try {
            return await PublicCategoriesService.getAllCategories(logger);
        } catch (error) {
            logger.error("PublicCategories: Unhandled error in GET /categories", { error });
            set.status = 500;
            return { success: false, error: "Internal Server Error" };
        }
    })
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
                logger.error("PublicCategories: Unhandled error in GET /categories/:id", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { params: categoryIdParams },
    );
