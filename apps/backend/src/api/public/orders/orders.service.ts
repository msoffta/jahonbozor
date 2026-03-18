import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { createOrderSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { Logger } from "@jahonbozor/logger";
import type { Token } from "@jahonbozor/schemas";
import type { CreateOrderBody, OrdersPagination } from "@jahonbozor/schemas/src/orders";
import type {
    UserOrderCreateResponse,
    UserOrderDeleteResponse,
    UserOrderDetailResponse,
    UserOrdersListResponse,
} from "@jahonbozor/schemas/src/orders";

interface ServiceContext {
    userId: number;
    user: Token;
    requestId?: string;
}

export abstract class PublicOrdersService {
    static async createOrder(
        orderData: CreateOrderBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<UserOrderCreateResponse> {
        try {
            const { userId, user, requestId } = context;
            const mergedItems = orderData.items.reduce<typeof orderData.items>((acc, item) => {
                const existing = acc.find((i) => i.productId === item.productId);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    acc.push({ ...item });
                }
                return acc;
            }, []);
            const productIds = mergedItems.map((item) => item.productId);

            const products = await prisma.product.findMany({
                where: {
                    id: { in: productIds },
                    deletedAt: null,
                },
                select: { id: true, name: true, price: true, remaining: true },
            });

            if (products.length !== productIds.length) {
                const foundIds = products.map((product) => product.id);
                const missingIds = productIds.filter((id) => !foundIds.includes(id));
                logger.warn("PublicOrders: Products not found or deleted", { missingIds, userId });
                return { success: false, error: `Products not found: ${missingIds.join(", ")}` };
            }

            // All productIds are guaranteed to exist in the map (validated by length check above)
            const productMap = new Map(products.map((product) => [product.id, product]));

            const insufficientStock: {
                productId: number;
                productName: string;
                requested: number;
                available: number;
            }[] = [];
            for (const item of mergedItems) {
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
                        comment: orderData.comment ?? null,
                        data: (orderData.data as Prisma.JsonObject) ?? {},
                        items: {
                            create: mergedItems.map((item) => {
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

                for (const item of mergedItems) {
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

            const mappedItems = order.items.map((item) => ({
                ...item,
                price: Number(item.price),
            }));

            return { success: true, data: { ...order, items: mappedItems } };
        } catch (error) {
            logger.error("PublicOrders: Error in createOrder", { userId: context.userId, error });
            return { success: false, error };
        }
    }

    static async getUserOrders(
        userId: number,
        query: OrdersPagination,
        logger: Logger,
    ): Promise<UserOrdersListResponse> {
        try {
            const { page, limit, sortBy, sortOrder, paymentType, dateFrom, dateTo } = query;

            const whereClause: Prisma.OrderWhereInput = {
                userId,
                deletedAt: null,
                ...(paymentType && { paymentType }),
                ...((dateFrom ?? dateTo) && {
                    createdAt: {
                        ...(dateFrom && { gte: dateFrom }),
                        ...(dateTo && { lte: dateTo }),
                    },
                }),
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
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            const mappedOrders = orders.map((order) => ({
                ...order,
                items: order.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: { ...item.product, price: Number(item.product.price) },
                })),
            }));

            return { success: true, data: { count, orders: mappedOrders } };
        } catch (error) {
            logger.error("PublicOrders: Error in getUserOrders", { userId, error });
            return { success: false, error };
        }
    }

    static async getUserOrder(
        orderId: number,
        userId: number,
        logger: Logger,
    ): Promise<UserOrderDetailResponse> {
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

            const mappedItems = order.items.map((item) => ({
                ...item,
                price: Number(item.price),
                product: { ...item.product, price: Number(item.product.price) },
            }));

            return { success: true, data: { ...order, items: mappedItems } };
        } catch (error) {
            logger.error("PublicOrders: Error in getUserOrder", { orderId, userId, error });
            return { success: false, error };
        }
    }

    static async cancelOrder(
        orderId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<UserOrderDeleteResponse> {
        try {
            const { userId, user, requestId } = context;

            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId, deletedAt: null },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, remaining: true, deletedAt: true } },
                        },
                    },
                },
            });

            if (!existingOrder) {
                logger.warn("PublicOrders: Order not found for cancel", { orderId, userId });
                return { success: false, error: "Order not found" };
            }

            if (existingOrder.userId !== userId) {
                logger.warn("PublicOrders: User not authorized to cancel order", {
                    orderId,
                    userId,
                    orderUserId: existingOrder.userId,
                });
                return { success: false, error: "Forbidden" };
            }

            await prisma.$transaction(async (transaction) => {
                for (const item of existingOrder.items) {
                    if (!item.product.deletedAt) {
                        const previousRemaining = item.product.remaining;
                        const newRemaining = previousRemaining + item.quantity;

                        await transaction.product.update({
                            where: { id: item.productId },
                            data: { remaining: { increment: item.quantity } },
                        });

                        await transaction.productHistory.create({
                            data: {
                                productId: item.productId,
                                staffId: null,
                                operation: "INVENTORY_ADD",
                                quantity: item.quantity,
                                previousData: { remaining: previousRemaining },
                                newData: { remaining: newRemaining },
                                changeReason: `Order #${orderId} cancelled by user`,
                            },
                        });
                    }
                }

                await transaction.order.update({
                    where: { id: orderId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId, user, logger },
                    {
                        entityType: "order",
                        entityId: orderId,
                        action: "DELETE",
                        previousData: createOrderSnapshot(existingOrder),
                    },
                );
            });

            logger.info("PublicOrders: Order cancelled and stock restored", {
                orderId,
                userId,
                itemsRestored: existingOrder.items.length,
            });

            return { success: true, data: { orderId, deleted: true } };
        } catch (error) {
            logger.error("PublicOrders: Error in cancelOrder", {
                orderId,
                userId: context.userId,
                error,
            });
            return { success: false, error };
        }
    }
}
