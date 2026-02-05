import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateSubcategoryBody,
    UpdateSubcategoryBody,
    SubcategoriesPagination,
} from "@jahonbozor/schemas/src/categories";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";

export abstract class SubcategoriesService {
    static async getAllSubcategories({
        page,
        limit,
        searchQuery,
        categoryId,
        includeCategory,
        includeProducts,
    }: SubcategoriesPagination): Promise<ReturnSchema> {
        try {
            const whereClause = {
                AND: [
                    searchQuery ? { name: { contains: searchQuery } } : {},
                    categoryId ? { categoryId } : {},
                ],
            };

            const [count, subcategories] = await prisma.$transaction([
                prisma.subcategory.count({ where: whereClause }),
                prisma.subcategory.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        category: includeCategory
                            ? { select: { id: true, name: true } }
                            : undefined,
                        products: includeProducts || undefined,
                    },
                }),
            ]);

            return {
                success: true,
                data: { count, subcategories },
            };
        } catch (error) {
            logger.error("Subcategories: Error in getAllSubcategories", { searchQuery, categoryId, page, limit, error });
            return { success: false, error };
        }
    }

    static async getSubcategory(
        subcategoryId: number,
        includeCategory?: boolean,
        includeProducts?: boolean,
    ): Promise<ReturnSchema> {
        try {
            const subcategory = await prisma.subcategory.findUnique({
                where: { id: subcategoryId },
                include: {
                    category: includeCategory
                        ? { select: { id: true, name: true } }
                        : undefined,
                    products: includeProducts || undefined,
                },
            });

            if (!subcategory) {
                logger.warn("Subcategories: Subcategory not found", { subcategoryId });
                return { success: false, error: "Subcategory not found" };
            }

            return { success: true, data: subcategory };
        } catch (error) {
            logger.error("Subcategories: Error in getSubcategory", { subcategoryId, error });
            return { success: false, error };
        }
    }

    static async createSubcategory(subcategoryData: CreateSubcategoryBody): Promise<ReturnSchema> {
        try {
            const categoryExists = await prisma.category.findUnique({
                where: { id: subcategoryData.categoryId },
            });

            if (!categoryExists) {
                logger.warn("Subcategories: Category not found", { categoryId: subcategoryData.categoryId });
                return { success: false, error: "Category not found" };
            }

            const existingSubcategory = await prisma.subcategory.findFirst({
                where: {
                    name: subcategoryData.name,
                    categoryId: subcategoryData.categoryId,
                },
            });

            if (existingSubcategory) {
                logger.warn("Subcategories: Subcategory name already exists in category", { name: subcategoryData.name, categoryId: subcategoryData.categoryId });
                return { success: false, error: "Subcategory name already exists in this category" };
            }

            const newSubcategory = await prisma.subcategory.create({
                data: {
                    name: subcategoryData.name,
                    categoryId: subcategoryData.categoryId,
                },
            });

            logger.info("Subcategories: Subcategory created", { subcategoryId: newSubcategory.id, name: subcategoryData.name, categoryId: subcategoryData.categoryId });
            return { success: true, data: newSubcategory };
        } catch (error) {
            logger.error("Subcategories: Error in createSubcategory", { name: subcategoryData.name, categoryId: subcategoryData.categoryId, error });
            return { success: false, error };
        }
    }

    static async updateSubcategory(
        subcategoryId: number,
        subcategoryData: UpdateSubcategoryBody,
    ): Promise<ReturnSchema> {
        try {
            const existingSubcategory = await prisma.subcategory.findUnique({
                where: { id: subcategoryId },
            });

            if (!existingSubcategory) {
                logger.warn("Subcategories: Subcategory not found for update", { subcategoryId });
                return { success: false, error: "Subcategory not found" };
            }

            const targetCategoryId = subcategoryData.categoryId ?? existingSubcategory.categoryId;

            if (subcategoryData.categoryId && subcategoryData.categoryId !== existingSubcategory.categoryId) {
                const categoryExists = await prisma.category.findUnique({
                    where: { id: subcategoryData.categoryId },
                });

                if (!categoryExists) {
                    logger.warn("Subcategories: Target category not found", { categoryId: subcategoryData.categoryId });
                    return { success: false, error: "Category not found" };
                }
            }

            if (subcategoryData.name || subcategoryData.categoryId) {
                const duplicateName = await prisma.subcategory.findFirst({
                    where: {
                        name: subcategoryData.name ?? existingSubcategory.name,
                        categoryId: targetCategoryId,
                        id: { not: subcategoryId },
                    },
                });

                if (duplicateName) {
                    logger.warn("Subcategories: Subcategory name already exists in category", { subcategoryId, name: subcategoryData.name, categoryId: targetCategoryId });
                    return { success: false, error: "Subcategory name already exists in this category" };
                }
            }

            const updatedSubcategory = await prisma.subcategory.update({
                where: { id: subcategoryId },
                data: subcategoryData,
            });

            logger.info("Subcategories: Subcategory updated", { subcategoryId });
            return { success: true, data: updatedSubcategory };
        } catch (error) {
            logger.error("Subcategories: Error in updateSubcategory", { subcategoryId, error });
            return { success: false, error };
        }
    }

    static async deleteSubcategory(subcategoryId: number): Promise<ReturnSchema> {
        try {
            const existingSubcategory = await prisma.subcategory.findUnique({
                where: { id: subcategoryId },
            });

            if (!existingSubcategory) {
                logger.warn("Subcategories: Subcategory not found for delete", { subcategoryId });
                return { success: false, error: "Subcategory not found" };
            }

            const productsCount = await prisma.product.count({
                where: { subcategoryId },
            });

            if (productsCount > 0) {
                logger.warn("Subcategories: Cannot delete subcategory with products", { subcategoryId, productsCount });
                return { success: false, error: "Cannot delete subcategory with products" };
            }

            const deletedSubcategory = await prisma.subcategory.delete({
                where: { id: subcategoryId },
            });

            logger.info("Subcategories: Subcategory deleted", { subcategoryId, name: deletedSubcategory.name });
            return { success: true, data: deletedSubcategory };
        } catch (error) {
            logger.error("Subcategories: Error in deleteSubcategory", { subcategoryId, error });
            return { success: false, error };
        }
    }
}
