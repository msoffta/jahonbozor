import type { PublicCategoriesListResponse, PublicCategoryDetailResponse } from "@jahonbozor/schemas/src/categories";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";

export abstract class PublicCategoriesService {
    static async getAllCategories(logger: Logger): Promise<PublicCategoriesListResponse> {
        try {
            const categories = await prisma.category.findMany({
                where: { parentId: null },
                select: {
                    id: true,
                    name: true,
                    children: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            });

            return { success: true, data: { categories } };
        } catch (error) {
            logger.error("PublicCategories: Error in getAllCategories", { error });
            return { success: false, error };
        }
    }

    static async getCategory(categoryId: number, logger: Logger): Promise<PublicCategoryDetailResponse> {
        try {
            const category = await prisma.category.findFirst({
                where: { id: categoryId },
                select: {
                    id: true,
                    name: true,
                    parentId: true,
                    parent: { select: { id: true, name: true } },
                    children: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!category) {
                logger.warn("PublicCategories: Category not found", { categoryId });
                return { success: false, error: "Category not found" };
            }

            return { success: true, data: category };
        } catch (error) {
            logger.error("PublicCategories: Error in getCategory", { categoryId, error });
            return { success: false, error };
        }
    }
}
