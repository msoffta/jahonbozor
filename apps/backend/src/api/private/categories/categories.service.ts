import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateCategoryBody,
    UpdateCategoryBody,
    CategoriesPagination,
} from "@jahonbozor/schemas/src/categories";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";

export abstract class CategoriesService {
    static async getAllCategories({
        page,
        limit,
        searchQuery,
        includeSubcategories,
        includeProducts,
    }: CategoriesPagination): Promise<ReturnSchema> {
        try {
            const whereClause = searchQuery
                ? { name: { contains: searchQuery } }
                : {};

            const [count, categories] = await prisma.$transaction([
                prisma.category.count({ where: whereClause }),
                prisma.category.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        subcategories: includeSubcategories || undefined,
                        products: includeProducts || undefined,
                    },
                }),
            ]);

            return {
                success: true,
                data: { count, categories },
            };
        } catch (error) {
            logger.error("Categories: Error in getAllCategories", { searchQuery, page, limit, error });
            return { success: false, error };
        }
    }

    static async getCategory(
        categoryId: number,
        includeSubcategories?: boolean,
        includeProducts?: boolean,
    ): Promise<ReturnSchema> {
        try {
            const category = await prisma.category.findUnique({
                where: { id: categoryId },
                include: {
                    subcategories: includeSubcategories || undefined,
                    products: includeProducts || undefined,
                },
            });

            if (!category) {
                logger.warn("Categories: Category not found", { categoryId });
                return { success: false, error: "Category not found" };
            }

            return { success: true, data: category };
        } catch (error) {
            logger.error("Categories: Error in getCategory", { categoryId, error });
            return { success: false, error };
        }
    }

    static async createCategory(categoryData: CreateCategoryBody): Promise<ReturnSchema> {
        try {
            const existingCategory = await prisma.category.findFirst({
                where: { name: categoryData.name },
            });

            if (existingCategory) {
                logger.warn("Categories: Category name already exists", { name: categoryData.name });
                return { success: false, error: "Category name already exists" };
            }

            const newCategory = await prisma.category.create({
                data: { name: categoryData.name },
            });

            logger.info("Categories: Category created", { categoryId: newCategory.id, name: categoryData.name });
            return { success: true, data: newCategory };
        } catch (error) {
            logger.error("Categories: Error in createCategory", { name: categoryData.name, error });
            return { success: false, error };
        }
    }

    static async updateCategory(
        categoryId: number,
        categoryData: UpdateCategoryBody,
    ): Promise<ReturnSchema> {
        try {
            const existingCategory = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!existingCategory) {
                logger.warn("Categories: Category not found for update", { categoryId });
                return { success: false, error: "Category not found" };
            }

            if (categoryData.name && categoryData.name !== existingCategory.name) {
                const duplicateName = await prisma.category.findFirst({
                    where: {
                        name: categoryData.name,
                        id: { not: categoryId },
                    },
                });

                if (duplicateName) {
                    logger.warn("Categories: Category name already exists", { categoryId, name: categoryData.name });
                    return { success: false, error: "Category name already exists" };
                }
            }

            const updatedCategory = await prisma.category.update({
                where: { id: categoryId },
                data: categoryData,
            });

            logger.info("Categories: Category updated", { categoryId });
            return { success: true, data: updatedCategory };
        } catch (error) {
            logger.error("Categories: Error in updateCategory", { categoryId, error });
            return { success: false, error };
        }
    }

    static async deleteCategory(categoryId: number): Promise<ReturnSchema> {
        try {
            const existingCategory = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!existingCategory) {
                logger.warn("Categories: Category not found for delete", { categoryId });
                return { success: false, error: "Category not found" };
            }

            const subcategoriesCount = await prisma.subcategory.count({
                where: { categoryId },
            });

            if (subcategoriesCount > 0) {
                logger.warn("Categories: Cannot delete category with subcategories", { categoryId, subcategoriesCount });
                return { success: false, error: "Cannot delete category with subcategories" };
            }

            const deletedCategory = await prisma.category.delete({
                where: { id: categoryId },
            });

            logger.info("Categories: Category deleted", { categoryId, name: deletedCategory.name });
            return { success: true, data: deletedCategory };
        } catch (error) {
            logger.error("Categories: Error in deleteCategory", { categoryId, error });
            return { success: false, error };
        }
    }
}
