import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { ProductsPagination } from "@jahonbozor/schemas/src/products";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";

export abstract class PublicProductsService {
    static async getAllProducts({
        page,
        limit,
        searchQuery,
        categoryId,
        subcategoryId,
        minPrice,
        maxPrice,
    }: ProductsPagination): Promise<ReturnSchema> {
        try {
            const whereClause = {
                deletedAt: null,
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
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        categoryId: true,
                        subcategoryId: true,
                        remaining: true,
                        createdAt: true,
                        updatedAt: true,
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
            const product = await prisma.product.findFirst({
                where: { id: productId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    categoryId: true,
                    subcategoryId: true,
                    remaining: true,
                    createdAt: true,
                    updatedAt: true,
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
}
