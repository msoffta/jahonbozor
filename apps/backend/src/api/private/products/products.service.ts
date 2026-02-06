import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateProductBody,
    UpdateProductBody,
    ProductsPagination,
} from "@jahonbozor/schemas/src/products";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import { auditInTransaction } from "@lib/audit";
import type { ProductModel } from "@generated/prisma/models/Product";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

function createProductSnapshot(product: ProductModel) {
    return {
        name: product.name,
        price: Number(product.price),
        costprice: Number(product.costprice),
        categoryId: product.categoryId,
        remaining: product.remaining,
    };
}

/**
 * Get all descendant category IDs for hierarchical filtering
 */
async function getCategoryWithDescendants(categoryId: number): Promise<number[]> {
    const ids = [categoryId];

    const children = await prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
    });

    for (const child of children) {
        const descendantIds = await getCategoryWithDescendants(child.id);
        ids.push(...descendantIds);
    }

    return ids;
}

export abstract class ProductsService {
    static async getAllProducts(
        params: ProductsPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const { page, limit, searchQuery, categoryId, minPrice, maxPrice, includeDeleted } = params;

            // Build where clause with hierarchical category filter
            const whereClause: Record<string, unknown> = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (searchQuery) {
                whereClause.name = { contains: searchQuery };
            }

            // Hierarchical category filter - include all descendants
            if (categoryId) {
                const categoryIds = await getCategoryWithDescendants(categoryId);
                whereClause.categoryId = { in: categoryIds };
            }

            if (minPrice) {
                whereClause.price = { ...(whereClause.price as object || {}), gte: minPrice };
            }

            if (maxPrice) {
                whereClause.price = { ...(whereClause.price as object || {}), lte: maxPrice };
            }

            const [count, products] = await prisma.$transaction([
                prisma.product.count({ where: whereClause }),
                prisma.product.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                                parent: { select: { id: true, name: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, products } };
        } catch (error) {
            logger.error("Products: Error in getAllProducts", { page: params.page, limit: params.limit, error });
            return { success: false, error };
        }
    }

    static async getProduct(productId: number, logger: Logger): Promise<ReturnSchema> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            parent: { select: { id: true, name: true } },
                        },
                    },
                },
            });

            if (!product) {
                logger.warn("Products: Product not found", { productId });
                return { success: false, error: "Product not found" };
            }

            return { success: true, data: product };
        } catch (error) {
            logger.error("Products: Error in getProduct", { productId, error });
            return { success: false, error };
        }
    }

    static async createProduct(
        productData: CreateProductBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const categoryExists = await prisma.category.findUnique({
                where: { id: productData.categoryId },
            });

            if (!categoryExists) {
                logger.warn("Products: Category not found", { categoryId: productData.categoryId });
                return { success: false, error: "Category not found" };
            }

            const [newProduct] = await prisma.$transaction(async (transaction) => {
                const product = await transaction.product.create({
                    data: {
                        name: productData.name,
                        price: productData.price,
                        costprice: productData.costprice,
                        categoryId: productData.categoryId,
                        remaining: productData.remaining ?? 0,
                    },
                });

                await transaction.productHistory.create({
                    data: {
                        productId: product.id,
                        staffId: context.staffId,
                        operation: "CREATE",
                        newData: createProductSnapshot(product),
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "product",
                        entityId: product.id,
                        action: "CREATE",
                        newData: createProductSnapshot(product),
                    },
                );

                return [product];
            });

            logger.info("Products: Product created", { productId: newProduct.id, name: productData.name, staffId: context.staffId });
            return { success: true, data: newProduct };
        } catch (error) {
            logger.error("Products: Error in createProduct", { name: productData.name, error });
            return { success: false, error };
        }
    }

    static async updateProduct(
        productId: number,
        productData: UpdateProductBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingProduct = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!existingProduct) {
                logger.warn("Products: Product not found for update", { productId });
                return { success: false, error: "Product not found" };
            }

            if (existingProduct.deletedAt) {
                logger.warn("Products: Cannot update deleted product", { productId });
                return { success: false, error: "Cannot update deleted product" };
            }

            if (productData.categoryId && productData.categoryId !== existingProduct.categoryId) {
                const categoryExists = await prisma.category.findUnique({
                    where: { id: productData.categoryId },
                });
                if (!categoryExists) {
                    logger.warn("Products: Target category not found", { categoryId: productData.categoryId });
                    return { success: false, error: "Category not found" };
                }
            }

            const [updatedProduct] = await prisma.$transaction(async (transaction) => {
                const product = await transaction.product.update({
                    where: { id: productId },
                    data: productData,
                });

                await transaction.productHistory.create({
                    data: {
                        productId,
                        staffId: context.staffId,
                        operation: "UPDATE",
                        previousData: createProductSnapshot(existingProduct),
                        newData: createProductSnapshot(product),
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "product",
                        entityId: productId,
                        action: "UPDATE",
                        previousData: createProductSnapshot(existingProduct),
                        newData: createProductSnapshot(product),
                    },
                );

                return [product];
            });

            logger.info("Products: Product updated", { productId, staffId: context.staffId });
            return { success: true, data: updatedProduct };
        } catch (error) {
            logger.error("Products: Error in updateProduct", { productId, error });
            return { success: false, error };
        }
    }

    static async deleteProduct(
        productId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingProduct = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!existingProduct) {
                logger.warn("Products: Product not found for delete", { productId });
                return { success: false, error: "Product not found" };
            }

            if (existingProduct.deletedAt) {
                logger.warn("Products: Product already deleted", { productId });
                return { success: false, error: "Product already deleted" };
            }

            const [deletedProduct] = await prisma.$transaction(async (transaction) => {
                const product = await transaction.product.update({
                    where: { id: productId },
                    data: { deletedAt: new Date() },
                });

                await transaction.productHistory.create({
                    data: {
                        productId,
                        staffId: context.staffId,
                        operation: "DELETE",
                        previousData: createProductSnapshot(existingProduct),
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "product",
                        entityId: productId,
                        action: "DELETE",
                        previousData: createProductSnapshot(existingProduct),
                    },
                );

                return [product];
            });

            logger.info("Products: Product deleted", { productId, name: existingProduct.name, staffId: context.staffId });
            return { success: true, data: deletedProduct };
        } catch (error) {
            logger.error("Products: Error in deleteProduct", { productId, error });
            return { success: false, error };
        }
    }

    static async restoreProduct(
        productId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingProduct = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!existingProduct) {
                logger.warn("Products: Product not found for restore", { productId });
                return { success: false, error: "Product not found" };
            }

            if (!existingProduct.deletedAt) {
                logger.warn("Products: Product is not deleted", { productId });
                return { success: false, error: "Product is not deleted" };
            }

            const [restoredProduct] = await prisma.$transaction(async (transaction) => {
                const product = await transaction.product.update({
                    where: { id: productId },
                    data: { deletedAt: null },
                });

                await transaction.productHistory.create({
                    data: {
                        productId,
                        staffId: context.staffId,
                        operation: "RESTORE",
                        previousData: { deletedAt: existingProduct.deletedAt },
                        newData: createProductSnapshot(product),
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "product",
                        entityId: productId,
                        action: "RESTORE",
                        previousData: { deletedAt: existingProduct.deletedAt },
                        newData: createProductSnapshot(product),
                    },
                );

                return [product];
            });

            logger.info("Products: Product restored", { productId, name: existingProduct.name, staffId: context.staffId });
            return { success: true, data: restoredProduct };
        } catch (error) {
            logger.error("Products: Error in restoreProduct", { productId, error });
            return { success: false, error };
        }
    }
}
