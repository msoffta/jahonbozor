import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateInventoryAdjustmentBody,
    ProductHistoryPagination,
} from "@jahonbozor/schemas/src/products";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import { auditInTransaction } from "@lib/audit";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

export abstract class HistoryService {
    static async getAllHistory(
        params: ProductHistoryPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const { page, limit, searchQuery, productId, operation, staffId, dateFrom, dateTo } = params;
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
            logger.error("History: Error in getAllHistory", { page: params.page, limit: params.limit, error });
            return { success: false, error };
        }
    }

    static async getHistoryEntry(historyId: number, logger: Logger): Promise<ReturnSchema> {
        try {
            const historyEntry = await prisma.productHistory.findUnique({
                where: { id: historyId },
                include: {
                    product: { select: { id: true, name: true, price: true } },
                    staff: { select: { id: true, fullname: true } },
                },
            });

            if (!historyEntry) {
                logger.warn("History: Entry not found", { historyId });
                return { success: false, error: "History entry not found" };
            }

            return { success: true, data: historyEntry };
        } catch (error) {
            logger.error("History: Error in getHistoryEntry", { historyId, error });
            return { success: false, error };
        }
    }

    static async getProductHistory(
        productId: number,
        params: ProductHistoryPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const { page, limit, operation, staffId, dateFrom, dateTo } = params;
            const whereClause = {
                productId,
                ...(operation && { operation }),
                ...(staffId && { staffId }),
                ...(dateFrom && { createdAt: { gte: dateFrom } }),
                ...(dateTo && { createdAt: { lte: dateTo } }),
            };

            const [count, history] = await prisma.$transaction([
                prisma.productHistory.count({ where: whereClause }),
                prisma.productHistory.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        staff: { select: { id: true, fullname: true } },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, history } };
        } catch (error) {
            logger.error("History: Error in getProductHistory", { productId, error });
            return { success: false, error };
        }
    }

    static async createInventoryAdjustment(
        productId: number,
        adjustmentData: CreateInventoryAdjustmentBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!product) {
                logger.warn("History: Product not found for inventory adjustment", { productId });
                return { success: false, error: "Product not found" };
            }

            if (product.deletedAt) {
                logger.warn("History: Cannot adjust inventory for deleted product", { productId });
                return { success: false, error: "Cannot adjust inventory for deleted product" };
            }

            const previousRemaining = product.remaining;
            let newRemaining: number;

            if (adjustmentData.operation === "INVENTORY_ADD") {
                newRemaining = previousRemaining + adjustmentData.quantity;
            } else {
                if (previousRemaining < adjustmentData.quantity) {
                    logger.warn("History: Insufficient stock for removal", {
                        productId,
                        requested: adjustmentData.quantity,
                        available: previousRemaining,
                    });
                    return { success: false, error: "Insufficient stock" };
                }
                newRemaining = previousRemaining - adjustmentData.quantity;
            }

            const [updatedProduct, historyEntry] = await prisma.$transaction(async (transaction) => {
                const updated = await transaction.product.update({
                    where: { id: productId },
                    data: { remaining: newRemaining },
                });

                const history = await transaction.productHistory.create({
                    data: {
                        productId,
                        staffId: context.staffId,
                        operation: adjustmentData.operation,
                        quantity: adjustmentData.quantity,
                        previousData: { remaining: previousRemaining },
                        newData: { remaining: newRemaining },
                        changeReason: adjustmentData.changeReason ?? null,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "product",
                        entityId: productId,
                        action: "INVENTORY_ADJUST",
                        previousData: { remaining: previousRemaining },
                        newData: { remaining: newRemaining },
                    },
                );

                return [updated, history];
            });

            logger.info("History: Inventory adjusted", {
                productId,
                operation: adjustmentData.operation,
                quantity: adjustmentData.quantity,
                previousRemaining,
                newRemaining,
                staffId: context.staffId,
            });

            return { success: true, data: { product: updatedProduct, historyEntry } };
        } catch (error) {
            logger.error("History: Error in createInventoryAdjustment", { productId, error });
            return { success: false, error };
        }
    }
}
