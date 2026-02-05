import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission, hasAnyPermission } from "@jahonbozor/schemas";
import {
    CreateOrderBody,
    UpdateOrderBody,
    OrdersPagination,
} from "@jahonbozor/schemas/src/orders";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";
import type { Prisma } from "@generated/prisma/client";

export abstract class OrdersService {
    static async getAllOrders(
        query: OrdersPagination,
        staffId: number,
        permissions: Permission[],
    ): Promise<ReturnSchema> {
        try {
            const { page, limit, searchQuery, userId, staffId: filterStaffId, paymentType, status, dateFrom, dateTo } = query;

            const canListAll = hasAnyPermission(permissions, [Permission.ORDERS_LIST_ALL]);

            const whereClause: Prisma.OrderWhereInput = {
                ...(paymentType && { paymentType }),
                ...(status && { status }),
                ...(dateFrom && { createdAt: { gte: dateFrom } }),
                ...(dateTo && { createdAt: { lte: dateTo } }),
            };

            if (canListAll) {
                if (userId) whereClause.userId = userId;
                if (filterStaffId) whereClause.staffId = filterStaffId;
            } else {
                whereClause.staffId = staffId;
            }

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
                        user: { select: { id: true, fullname: true, phone: true } },
                        staff: { select: { id: true, fullname: true } },
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return { success: true, data: { count, orders } };
        } catch (error) {
            logger.error("Orders: Error in getAllOrders", { error });
            return { success: false, error };
        }
    }

    static async getOrder(
        orderId: number,
        staffId: number,
        permissions: Permission[],
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
                    user: { select: { id: true, fullname: true, phone: true } },
                    staff: { select: { id: true, fullname: true } },
                },
            });

            if (!order) {
                logger.warn("Orders: Order not found", { orderId });
                return { success: false, error: "Order not found" };
            }

            const canReadAll = hasAnyPermission(permissions, [Permission.ORDERS_READ_ALL]);
            if (!canReadAll && order.staffId !== staffId) {
                logger.warn("Orders: Insufficient permissions to read order", {
                    orderId,
                    staffId,
                    orderStaffId: order.staffId,
                });
                return { success: false, error: "Forbidden" };
            }

            return { success: true, data: order };
        } catch (error) {
            logger.error("Orders: Error in getOrder", { orderId, error });
            return { success: false, error };
        }
    }

    static async createOrder(
        orderData: CreateOrderBody,
        staffId: number,
    ): Promise<ReturnSchema> {
        try {
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
                logger.warn("Orders: Products not found or deleted", { missingIds });
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
                logger.warn("Orders: Insufficient stock", { insufficientStock });
                return {
                    success: false,
                    error: {
                        code: "INSUFFICIENT_STOCK",
                        message: "One or more products have insufficient stock",
                        details: insufficientStock,
                    },
                };
            }

            const order = await prisma.$transaction(async (transaction) => {
                const newOrder = await transaction.order.create({
                    data: {
                        userId: orderData.userId ?? null,
                        staffId,
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
                        user: { select: { id: true, fullname: true } },
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
                            staffId,
                            operation: "INVENTORY_REMOVE",
                            quantity: item.quantity,
                            previousData: { remaining: previousRemaining },
                            newData: { remaining: newRemaining },
                            changeReason: `Order #${newOrder.id}`,
                        },
                    });
                }

                return newOrder;
            });

            logger.info("Orders: Order created", {
                orderId: order.id,
                staffId,
                itemCount: order.items.length,
            });

            return { success: true, data: order };
        } catch (error) {
            logger.error("Orders: Error in createOrder", { error });
            return { success: false, error };
        }
    }

    static async updateOrder(
        orderId: number,
        orderData: UpdateOrderBody,
        staffId: number,
        permissions: Permission[],
    ): Promise<ReturnSchema> {
        try {
            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!existingOrder) {
                logger.warn("Orders: Order not found for update", { orderId });
                return { success: false, error: "Order not found" };
            }

            const canUpdateAll = hasAnyPermission(permissions, [Permission.ORDERS_UPDATE_ALL]);
            if (!canUpdateAll && existingOrder.staffId !== staffId) {
                logger.warn("Orders: Insufficient permissions to update order", {
                    orderId,
                    staffId,
                    orderStaffId: existingOrder.staffId,
                });
                return { success: false, error: "Forbidden" };
            }

            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: {
                    ...(orderData.paymentType && { paymentType: orderData.paymentType }),
                    ...(orderData.status && { status: orderData.status }),
                    ...(orderData.data && { data: orderData.data as Prisma.JsonObject }),
                },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true } },
                        },
                    },
                    user: { select: { id: true, fullname: true } },
                    staff: { select: { id: true, fullname: true } },
                },
            });

            logger.info("Orders: Order updated", { orderId, staffId });
            return { success: true, data: updatedOrder };
        } catch (error) {
            logger.error("Orders: Error in updateOrder", { orderId, error });
            return { success: false, error };
        }
    }

    static async deleteOrder(orderId: number, staffId: number): Promise<ReturnSchema> {
        try {
            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, remaining: true, deletedAt: true } },
                        },
                    },
                },
            });

            if (!existingOrder) {
                logger.warn("Orders: Order not found for delete", { orderId });
                return { success: false, error: "Order not found" };
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
                                staffId,
                                operation: "INVENTORY_ADD",
                                quantity: item.quantity,
                                previousData: { remaining: previousRemaining },
                                newData: { remaining: newRemaining },
                                changeReason: `Order #${orderId} deleted`,
                            },
                        });
                    }
                }

                await transaction.orderItem.deleteMany({
                    where: { orderId },
                });

                await transaction.order.delete({
                    where: { id: orderId },
                });
            });

            logger.info("Orders: Order deleted and stock restored", {
                orderId,
                itemsRestored: existingOrder.items.length,
                staffId,
            });

            return { success: true, data: { orderId, deleted: true } };
        } catch (error) {
            logger.error("Orders: Error in deleteOrder", { orderId, error });
            return { success: false, error };
        }
    }
}
