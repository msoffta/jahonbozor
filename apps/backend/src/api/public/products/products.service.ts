import type { PublicProductsListResponse, PublicProductDetailResponse } from "@jahonbozor/schemas/src/products";
import { ProductsPagination } from "@jahonbozor/schemas/src/products";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";

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

export abstract class PublicProductsService {
    static async getAllProducts(
        { page, limit, searchQuery, categoryIds: categoryIdsStr, minPrice, maxPrice }: ProductsPagination,
        logger: Logger,
    ): Promise<PublicProductsListResponse> {
        try {
            const whereClause: Record<string, unknown> = {
                deletedAt: null,
            };

            if (searchQuery) {
                whereClause.name = { contains: searchQuery };
            }

            // Hierarchical category filter - include all descendants
            if (categoryIdsStr) {
                const parsedIds = categoryIdsStr.split(",").map(Number).filter((n) => !isNaN(n));
                const allIds: number[] = [];
                for (const id of parsedIds) {
                    const descendants = await getCategoryWithDescendants(id);
                    allIds.push(...descendants);
                }
                whereClause.categoryId = { in: [...new Set(allIds)] };
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
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        categoryId: true,
                        remaining: true,
                        createdAt: true,
                        updatedAt: true,
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

            const mapped = products.map(p => ({ ...p, price: Number(p.price) }));

            return { success: true, data: { count, products: mapped } };
        } catch (error) {
            logger.error("Products: Error in getAllProducts", { page, limit, error });
            return { success: false, error };
        }
    }

    static async getProduct(productId: number, logger: Logger): Promise<PublicProductDetailResponse> {
        try {
            const product = await prisma.product.findFirst({
                where: { id: productId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    categoryId: true,
                    remaining: true,
                    createdAt: true,
                    updatedAt: true,
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

            return { success: true, data: { ...product, price: Number(product.price) } };
        } catch (error) {
            logger.error("Products: Error in getProduct", { productId, error });
            return { success: false, error };
        }
    }
}
