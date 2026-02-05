import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateInventoryAdjustmentBody,
    ProductHistoryPagination,
} from "@jahonbozor/schemas/src/product-history";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";

export abstract class ProductHistoryService {
    static async getAllHistory({
        page,
        limit,
        searchQuery,
        productId,
        operation,
        staffId,
        dateFrom,
        dateTo,
    }: ProductHistoryPagination): Promise<ReturnSchema> {
        try {
            const whereClause = {
                ...(productId && { productId }),
                ...(operation && { operation }),
                ...(staffId && { staffId }),
                ...(dateFrom && { createdAt: { gte: dateFrom } }),
                ...(dateTo && { createdAt: { lte: dateTo } }),
                ...(searchQuery && { product: { name: { contains: searchQuery } } }),
            };

            const [count, history] = await prisma.$transaction([
                prisma.productHistory.count({ where: whereClause }),
                prisma.productHistory.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        product: { select: { id: true, name: true, price: true } },
                        staff: { select: { id: true, fullname: true } },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, history } };
        } catch (error) {
            logger.error("ProductHistory: Error in getAllHistory", { page, limit, error });
            return { success: false, error };
        }
    }

    static async getHistoryEntry(historyId: number): Promise<ReturnSchema> {
        try {
            const historyEntry = await prisma.productHistory.findUnique({
                where: { id: historyId },
                include: {
                    product: { select: { id: true, name: true, price: true } },
                    staff: { select: { id: true, fullname: true } },
                },
            });

            if (!historyEntry) {
                logger.warn("ProductHistory: Entry not found", { historyId });
                return { success: false, error: "History entry not found" };
            }

            return { success: true, data: historyEntry };
        } catch (error) {
            logger.error("ProductHistory: Error in getHistoryEntry", { historyId, error });
            return { success: false, error };
        }
    }

    static async createInventoryAdjustment(
        adjustmentData: CreateInventoryAdjustmentBody,
        staffId: number,
    ): Promise<ReturnSchema> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: adjustmentData.productId },
            });

            if (!product) {
                logger.warn("ProductHistory: Product not found for inventory adjustment", {
                    productId: adjustmentData.productId,
                });
                return { success: false, error: "Product not found" };
            }

            if (product.deletedAt) {
                logger.warn("ProductHistory: Cannot adjust inventory for deleted product", {
                    productId: adjustmentData.productId,
                });
                return { success: false, error: "Cannot adjust inventory for deleted product" };
            }

            const previousRemaining = product.remaining;
            let newRemaining: number;

            if (adjustmentData.operation === "INVENTORY_ADD") {
                newRemaining = previousRemaining + adjustmentData.quantity;
            } else {
                if (previousRemaining < adjustmentData.quantity) {
                    logger.warn("ProductHistory: Insufficient stock for removal", {
                        productId: adjustmentData.productId,
                        requested: adjustmentData.quantity,
                        available: previousRemaining,
                    });
                    return { success: false, error: "Insufficient stock" };
                }
                newRemaining = previousRemaining - adjustmentData.quantity;
            }

            const [updatedProduct, historyEntry] = await prisma.$transaction([
                prisma.product.update({
                    where: { id: adjustmentData.productId },
                    data: { remaining: newRemaining },
                }),
                prisma.productHistory.create({
                    data: {
                        productId: adjustmentData.productId,
                        staffId,
                        operation: adjustmentData.operation,
                        quantity: adjustmentData.quantity,
                        previousData: { remaining: previousRemaining },
                        newData: { remaining: newRemaining },
                        changeReason: adjustmentData.changeReason ?? null,
                    },
                }),
            ]);

            logger.info("ProductHistory: Inventory adjusted", {
                productId: adjustmentData.productId,
                operation: adjustmentData.operation,
                quantity: adjustmentData.quantity,
                previousRemaining,
                newRemaining,
                staffId,
            });

            return { success: true, data: { product: updatedProduct, historyEntry } };
        } catch (error) {
            logger.error("ProductHistory: Error in createInventoryAdjustment", {
                productId: adjustmentData.productId,
                error,
            });
            return { success: false, error };
        }
    }
}
