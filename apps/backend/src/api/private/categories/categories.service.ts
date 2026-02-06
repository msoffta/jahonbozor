import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateCategoryBody,
    UpdateCategoryBody,
    CategoriesPagination,
} from "@jahonbozor/schemas/src/categories";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import { auditInTransaction } from "@lib/audit";
import type { Prisma } from "@generated/prisma/client";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

function createCategorySnapshot(category: { id: number; name: string; parentId: number | null }) {
    return {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
    };
}

export abstract class CategoriesService {
    /**
     * Build nested include clause for children based on depth
     */
    private static buildChildrenInclude(
        depth: number,
        includeProducts: boolean,
    ): Prisma.CategoryInclude | undefined {
        if (depth <= 0) return undefined;

        const nestedInclude = this.buildChildrenInclude(depth - 1, includeProducts);

        return {
            children: nestedInclude
                ? { include: { ...nestedInclude, products: includeProducts || undefined } }
                : true,
        };
    }

    static async getAllCategories(
        params: CategoriesPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const {
                page,
                limit,
                searchQuery,
                parentId,
                includeChildren,
                includeProducts,
                includeParent,
                depth = 1,
            } = params;

            const whereClause: Prisma.CategoryWhereInput = {};

            if (searchQuery) {
                whereClause.name = { contains: searchQuery };
            }

            // parentId filter: undefined = all, null = root only, number = specific parent
            if (parentId !== undefined) {
                whereClause.parentId = parentId;
            }

            const includeClause: Prisma.CategoryInclude = {};

            if (includeChildren) {
                const nestedInclude = depth > 1
                    ? this.buildChildrenInclude(depth - 1, includeProducts || false)
                    : undefined;

                includeClause.children = nestedInclude
                    ? { include: { ...nestedInclude, products: includeProducts || undefined } }
                    : true;
            }

            if (includeProducts) {
                includeClause.products = true;
            }

            if (includeParent) {
                includeClause.parent = { select: { id: true, name: true, parentId: true } };
            }

            const hasIncludes = Object.keys(includeClause).length > 0;

            const [count, categories] = await prisma.$transaction([
                prisma.category.count({ where: whereClause }),
                prisma.category.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: hasIncludes ? includeClause : undefined,
                    orderBy: { name: "asc" },
                }),
            ]);

            return {
                success: true,
                data: { count, categories },
            };
        } catch (error) {
            logger.error("Categories: Error in getAllCategories", { params, error });
            return { success: false, error };
        }
    }

    static async getCategory(
        categoryId: number,
        includeChildren: boolean | undefined,
        includeProducts: boolean | undefined,
        includeParent: boolean | undefined,
        depth: number = 1,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const includeClause: Prisma.CategoryInclude = {};

            if (includeChildren) {
                const nestedInclude = depth > 1
                    ? this.buildChildrenInclude(depth - 1, includeProducts || false)
                    : undefined;

                includeClause.children = nestedInclude
                    ? { include: { ...nestedInclude, products: includeProducts || undefined } }
                    : true;
            }

            if (includeProducts) {
                includeClause.products = true;
            }

            if (includeParent) {
                includeClause.parent = { select: { id: true, name: true, parentId: true } };
            }

            const hasIncludes = Object.keys(includeClause).length > 0;

            const category = await prisma.category.findUnique({
                where: { id: categoryId },
                include: hasIncludes ? includeClause : undefined,
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

    static async createCategory(
        categoryData: CreateCategoryBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            // Validate parent exists if parentId provided
            if (categoryData.parentId) {
                const parentExists = await prisma.category.findUnique({
                    where: { id: categoryData.parentId },
                });

                if (!parentExists) {
                    logger.warn("Categories: Parent category not found", {
                        parentId: categoryData.parentId,
                    });
                    return { success: false, error: "Parent category not found" };
                }
            }

            // Check for duplicate name within same parent level
            const existingCategory = await prisma.category.findFirst({
                where: {
                    name: categoryData.name,
                    parentId: categoryData.parentId ?? null,
                },
            });

            if (existingCategory) {
                logger.warn("Categories: Category name already exists at this level", {
                    name: categoryData.name,
                    parentId: categoryData.parentId,
                });
                return { success: false, error: "Category name already exists at this level" };
            }

            const [newCategory] = await prisma.$transaction(async (transaction) => {
                const category = await transaction.category.create({
                    data: {
                        name: categoryData.name,
                        parentId: categoryData.parentId ?? null,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "category",
                        entityId: category.id,
                        action: "CREATE",
                        newData: createCategorySnapshot(category),
                    },
                );

                return [category];
            });

            logger.info("Categories: Category created", {
                categoryId: newCategory.id,
                name: categoryData.name,
                parentId: categoryData.parentId,
                staffId: context.staffId,
            });

            return { success: true, data: newCategory };
        } catch (error) {
            logger.error("Categories: Error in createCategory", { categoryData, error });
            return { success: false, error };
        }
    }

    /**
     * Check if potentialDescendant is a descendant of categoryId (to prevent circular references)
     */
    private static async isDescendantOf(
        potentialDescendant: number,
        categoryId: number,
    ): Promise<boolean> {
        let current = await prisma.category.findUnique({
            where: { id: potentialDescendant },
            select: { parentId: true },
        });

        while (current?.parentId) {
            if (current.parentId === categoryId) {
                return true;
            }

            current = await prisma.category.findUnique({
                where: { id: current.parentId },
                select: { parentId: true },
            });
        }

        return false;
    }

    static async updateCategory(
        categoryId: number,
        categoryData: UpdateCategoryBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingCategory = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!existingCategory) {
                logger.warn("Categories: Category not found for update", { categoryId });
                return { success: false, error: "Category not found" };
            }

            // Validate new parent if changing
            if (
                categoryData.parentId !== undefined &&
                categoryData.parentId !== existingCategory.parentId
            ) {
                if (categoryData.parentId !== null) {
                    // Cannot set parent to self
                    if (categoryData.parentId === categoryId) {
                        logger.warn("Categories: Cannot set category as its own parent", {
                            categoryId,
                        });
                        return { success: false, error: "Cannot set category as its own parent" };
                    }

                    // Check parent exists
                    const parentExists = await prisma.category.findUnique({
                        where: { id: categoryData.parentId },
                    });

                    if (!parentExists) {
                        logger.warn("Categories: Parent category not found", {
                            parentId: categoryData.parentId,
                        });
                        return { success: false, error: "Parent category not found" };
                    }

                    // Prevent circular reference (parent cannot be a descendant)
                    const isDescendant = await this.isDescendantOf(
                        categoryData.parentId,
                        categoryId,
                    );

                    if (isDescendant) {
                        logger.warn("Categories: Cannot create circular reference", {
                            categoryId,
                            parentId: categoryData.parentId,
                        });
                        return {
                            success: false,
                            error: "Cannot set a descendant as parent (circular reference)",
                        };
                    }
                }
            }

            // Check for duplicate name at target level
            const targetParentId =
                categoryData.parentId !== undefined
                    ? categoryData.parentId
                    : existingCategory.parentId;

            if (categoryData.name || categoryData.parentId !== undefined) {
                const duplicateName = await prisma.category.findFirst({
                    where: {
                        name: categoryData.name ?? existingCategory.name,
                        parentId: targetParentId,
                        id: { not: categoryId },
                    },
                });

                if (duplicateName) {
                    logger.warn("Categories: Category name already exists at target level", {
                        categoryId,
                        name: categoryData.name,
                        parentId: targetParentId,
                    });
                    return { success: false, error: "Category name already exists at this level" };
                }
            }

            const [updatedCategory] = await prisma.$transaction(async (transaction) => {
                const category = await transaction.category.update({
                    where: { id: categoryId },
                    data: categoryData,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "category",
                        entityId: categoryId,
                        action: "UPDATE",
                        previousData: createCategorySnapshot(existingCategory),
                        newData: createCategorySnapshot(category),
                    },
                );

                return [category];
            });

            logger.info("Categories: Category updated", { categoryId, staffId: context.staffId });
            return { success: true, data: updatedCategory };
        } catch (error) {
            logger.error("Categories: Error in updateCategory", { categoryId, error });
            return { success: false, error };
        }
    }

    static async deleteCategory(
        categoryId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingCategory = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!existingCategory) {
                logger.warn("Categories: Category not found for delete", { categoryId });
                return { success: false, error: "Category not found" };
            }

            // Check for child categories
            const childrenCount = await prisma.category.count({
                where: { parentId: categoryId },
            });

            if (childrenCount > 0) {
                logger.warn("Categories: Cannot delete category with children", {
                    categoryId,
                    childrenCount,
                });
                return { success: false, error: "Cannot delete category with child categories" };
            }

            // Check for products
            const productsCount = await prisma.product.count({
                where: { categoryId },
            });

            if (productsCount > 0) {
                logger.warn("Categories: Cannot delete category with products", {
                    categoryId,
                    productsCount,
                });
                return { success: false, error: "Cannot delete category with products" };
            }

            const [deletedCategory] = await prisma.$transaction(async (transaction) => {
                const category = await transaction.category.delete({
                    where: { id: categoryId },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "category",
                        entityId: categoryId,
                        action: "DELETE",
                        previousData: createCategorySnapshot(existingCategory),
                    },
                );

                return [category];
            });

            logger.info("Categories: Category deleted", {
                categoryId,
                name: deletedCategory.name,
                staffId: context.staffId,
            });

            return { success: true, data: deletedCategory };
        } catch (error) {
            logger.error("Categories: Error in deleteCategory", { categoryId, error });
            return { success: false, error };
        }
    }

    /**
     * Get full category tree (all root categories with nested children)
     */
    static async getCategoryTree(depth: number = 3, logger: Logger): Promise<ReturnSchema> {
        try {
            const nestedInclude = this.buildChildrenInclude(depth, false);

            const rootCategories = await prisma.category.findMany({
                where: { parentId: null },
                include: nestedInclude,
                orderBy: { name: "asc" },
            });

            return { success: true, data: rootCategories };
        } catch (error) {
            logger.error("Categories: Error in getCategoryTree", { depth, error });
            return { success: false, error };
        }
    }
}
