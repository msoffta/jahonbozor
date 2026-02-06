import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { CreateOrderBody, OrdersPagination } from "@jahonbozor/schemas/src/orders";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import { auditInTransaction } from "@lib/audit";
import type { Prisma, Order } from "@generated/prisma/client";

interface ServiceContext {
    userId: number;
    user: Token;
    requestId?: string;
}

function createOrderSnapshot(order: Pick<Order, "userId" | "staffId" | "paymentType" | "status" | "data">) {
    return {
        userId: order.userId,
        staffId: order.staffId,
        paymentType: order.paymentType,
        status: order.status,
        data: order.data,
    };
}

export abstract class PublicOrdersService {
    static async createOrder(
        orderData: CreateOrderBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const { userId, user, requestId } = context;
            const productIds = orderData.items.map(item => item.productId);

            const products = await prisma.product.findMany({
                where: {
                    id: { in: productIds },
                    deletedAt: null,
                },
                select: { id: true, name: true, price: true, remaining: true },
            });

            if (products.length !== productIds.length) {
                const foundIds = products.map(product => product.id);
                const missingIds = productIds.filter(id => !foundIds.includes(id));
                logger.warn("PublicOrders: Products not found or deleted", { missingIds, userId });
                return { success: false, error: `Products not found: ${missingIds.join(", ")}` };
            }

            const productMap = new Map(products.map(product => [product.id, product]));

            const insufficientStock: Array<{ productId: number; productName: string; requested: number; available: number }> = [];
            for (const item of orderData.items) {
                const product = productMap.get(item.productId)!;
                if (product.remaining < item.quantity) {
                    insufficientStock.push({
                        productId: item.productId,
                        productName: product.name,
                        requested: item.quantity,
                        available: product.remaining,
                    });
                }
            }

            if (insufficientStock.length > 0) {
                logger.warn("PublicOrders: Insufficient stock", { insufficientStock, userId });
                return {
                    success: false,
                    error: {
                        code: "INSUFFICIENT_STOCK",
                        message: "One or more products have insufficient stock",
                        details: insufficientStock,
                    },
                };
            }

            const [order] = await prisma.$transaction(async (transaction) => {
                const newOrder = await transaction.order.create({
                    data: {
                        userId,
                        staffId: null,
                        paymentType: orderData.paymentType,
                        status: "NEW",
                        data: (orderData.data as Prisma.JsonObject) ?? {},
                        items: {
                            create: orderData.items.map(item => {
                                const product = productMap.get(item.productId)!;
                                return {
                                    productId: item.productId,
                                    quantity: item.quantity,
                                    price: product.price,
                                    data: (item.data as Prisma.JsonObject) ?? null,
                                };
                            }),
                        },
                    },
                    include: {
                        items: {
                            include: {
                                product: { select: { id: true, name: true } },
                            },
                        },
                    },
                });

                for (const item of orderData.items) {
                    const product = productMap.get(item.productId)!;
                    const previousRemaining = product.remaining;
                    const newRemaining = previousRemaining - item.quantity;

                    await transaction.product.update({
                        where: { id: item.productId },
                        data: { remaining: { decrement: item.quantity } },
                    });

                    await transaction.productHistory.create({
                        data: {
                            productId: item.productId,
                            staffId: null,
                            operation: "INVENTORY_REMOVE",
                            quantity: item.quantity,
                            previousData: { remaining: previousRemaining },
                            newData: { remaining: newRemaining },
                            changeReason: `Order #${newOrder.id} (user)`,
                        },
                    });
                }

                await auditInTransaction(
                    transaction,
                    { requestId, user, logger },
                    {
                        entityType: "order",
                        entityId: newOrder.id,
                        action: "CREATE",
                        newData: createOrderSnapshot(newOrder),
                    },
                );

                return [newOrder];
            });

            logger.info("PublicOrders: Order created", {
                orderId: order.id,
                userId,
                itemCount: order.items.length,
            });

            return { success: true, data: order };
        } catch (error) {
            logger.error("PublicOrders: Error in createOrder", { userId: context.userId, error });
            return { success: false, error };
        }
    }

    static async getUserOrders(
        userId: number,
        query: OrdersPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const { page, limit, paymentType, status, dateFrom, dateTo } = query;

            const whereClause: Prisma.OrderWhereInput = {
                userId,
                ...(paymentType && { paymentType }),
                ...(status && { status }),
                ...(dateFrom && { createdAt: { gte: dateFrom } }),
                ...(dateTo && { createdAt: { lte: dateTo } }),
            };

            const [count, orders] = await prisma.$transaction([
                prisma.order.count({ where: whereClause }),
                prisma.order.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        items: {
                            include: {
                                product: { select: { id: true, name: true, price: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, orders } };
        } catch (error) {
            logger.error("PublicOrders: Error in getUserOrders", { userId, error });
            return { success: false, error };
        }
    }

    static async getUserOrder(
        orderId: number,
        userId: number,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, price: true } },
                        },
                    },
                },
            });

            if (!order) {
                logger.warn("PublicOrders: Order not found", { orderId, userId });
                return { success: false, error: "Order not found" };
            }

            if (order.userId !== userId) {
                logger.warn("PublicOrders: User not authorized to view order", {
                    orderId,
                    userId,
                    orderUserId: order.userId,
                });
                return { success: false, error: "Forbidden" };
            }

            return { success: true, data: order };
        } catch (error) {
            logger.error("PublicOrders: Error in getUserOrder", { orderId, userId, error });
            return { success: false, error };
        }
    }
}
