import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateProductBody,
    UpdateProductBody,
    ProductsPagination,
} from "@jahonbozor/schemas/src/products";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";
import type { ProductModel } from "@generated/prisma/models/Product";

function createProductSnapshot(product: ProductModel) {
    return {
        name: product.name,
        price: Number(product.price),
        costprice: Number(product.costprice),
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        remaining: product.remaining,
    };
}

export abstract class ProductsService {
    static async getAllProducts({
        page,
        limit,
        searchQuery,
        categoryId,
        subcategoryId,
        minPrice,
        maxPrice,
        includeDeleted,
    }: ProductsPagination): Promise<ReturnSchema> {
        try {
            const whereClause = {
                ...(includeDeleted ? {} : { deletedAt: null }),
                ...(searchQuery && { name: { contains: searchQuery } }),
                ...(categoryId && { categoryId }),
                ...(subcategoryId && { subcategoryId }),
                ...(minPrice && { price: { gte: minPrice } }),
                ...(maxPrice && { price: { lte: maxPrice } }),
            };

            const [count, products] = await prisma.$transaction([
                prisma.product.count({ where: whereClause }),
                prisma.product.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        category: { select: { id: true, name: true } },
                        subcategory: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, products } };
        } catch (error) {
            logger.error("Products: Error in getAllProducts", { page, limit, error });
            return { success: false, error };
        }
    }

    static async getProduct(productId: number): Promise<ReturnSchema> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    category: { select: { id: true, name: true } },
                    subcategory: { select: { id: true, name: true } },
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
        staffId: number,
    ): Promise<ReturnSchema> {
        try {
            const categoryExists = await prisma.category.findUnique({
                where: { id: productData.categoryId },
            });

            if (!categoryExists) {
                logger.warn("Products: Category not found", { categoryId: productData.categoryId });
                return { success: false, error: "Category not found" };
            }

            if (productData.subcategoryId) {
                const subcategoryExists = await prisma.subcategory.findUnique({
                    where: { id: productData.subcategoryId },
                });

                if (!subcategoryExists) {
                    logger.warn("Products: Subcategory not found", { subcategoryId: productData.subcategoryId });
                    return { success: false, error: "Subcategory not found" };
                }

                if (subcategoryExists.categoryId !== productData.categoryId) {
                    logger.warn("Products: Subcategory does not belong to category", {
                        subcategoryId: productData.subcategoryId,
                        categoryId: productData.categoryId,
                    });
                    return { success: false, error: "Subcategory does not belong to specified category" };
                }
            }

            const [newProduct] = await prisma.$transaction(async (transaction) => {
                const product = await transaction.product.create({
                    data: {
                        name: productData.name,
                        price: productData.price,
                        costprice: productData.costprice,
                        categoryId: productData.categoryId,
                        subcategoryId: productData.subcategoryId ?? null,
                        remaining: productData.remaining ?? 0,
                    },
                });

                await transaction.productHistory.create({
                    data: {
                        productId: product.id,
                        staffId,
                        operation: "CREATE",
                        newData: createProductSnapshot(product),
                    },
                });

                return [product];
            });

            logger.info("Products: Product created", { productId: newProduct.id, name: productData.name, staffId });
            return { success: true, data: newProduct };
        } catch (error) {
            logger.error("Products: Error in createProduct", { name: productData.name, error });
            return { success: false, error };
        }
    }

    static async updateProduct(
        productId: number,
        productData: UpdateProductBody,
        staffId: number,
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

            if (productData.subcategoryId !== undefined) {
                const targetCategoryId = productData.categoryId ?? existingProduct.categoryId;
                if (productData.subcategoryId !== null) {
                    const subcategoryExists = await prisma.subcategory.findUnique({
                        where: { id: productData.subcategoryId },
                    });
                    if (!subcategoryExists) {
                        logger.warn("Products: Target subcategory not found", { subcategoryId: productData.subcategoryId });
                        return { success: false, error: "Subcategory not found" };
                    }
                    if (subcategoryExists.categoryId !== targetCategoryId) {
                        logger.warn("Products: Subcategory does not belong to category", {
                            subcategoryId: productData.subcategoryId,
                            categoryId: targetCategoryId,
                        });
                        return { success: false, error: "Subcategory does not belong to specified category" };
                    }
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
                        staffId,
                        operation: "UPDATE",
                        previousData: createProductSnapshot(existingProduct),
                        newData: createProductSnapshot(product),
                    },
                });

                return [product];
            });

            logger.info("Products: Product updated", { productId, staffId });
            return { success: true, data: updatedProduct };
        } catch (error) {
            logger.error("Products: Error in updateProduct", { productId, error });
            return { success: false, error };
        }
    }

    static async deleteProduct(productId: number, staffId: number): Promise<ReturnSchema> {
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
                        staffId,
                        operation: "DELETE",
                        previousData: createProductSnapshot(existingProduct),
                    },
                });

                return [product];
            });

            logger.info("Products: Product deleted", { productId, name: existingProduct.name, staffId });
            return { success: true, data: deletedProduct };
        } catch (error) {
            logger.error("Products: Error in deleteProduct", { productId, error });
            return { success: false, error };
        }
    }

    static async restoreProduct(productId: number, staffId: number): Promise<ReturnSchema> {
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
                        staffId,
                        operation: "RESTORE",
                        previousData: { deletedAt: existingProduct.deletedAt },
                        newData: createProductSnapshot(product),
                    },
                });

                return [product];
            });

            logger.info("Products: Product restored", { productId, name: existingProduct.name, staffId });
            return { success: true, data: restoredProduct };
        } catch (error) {
            logger.error("Products: Error in restoreProduct", { productId, error });
            return { success: false, error };
        }
    }
}
