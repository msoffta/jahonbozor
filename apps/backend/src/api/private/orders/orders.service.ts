import { hasAnyPermission, Permission } from "@jahonbozor/schemas";

import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { createOrderSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    AdminOrderDeleteResponse,
    AdminOrderDetailResponse,
    AdminOrdersListResponse,
    CreateOrderBody,
    OrdersPagination,
    UpdateOrderBody,
} from "@jahonbozor/schemas/src/orders";

export abstract class OrdersService {
    static async getAllOrders(
        query: OrdersPagination,
        staffId: number,
        permissions: Permission[],
        logger: Logger,
    ): Promise<AdminOrdersListResponse> {
        try {
            const {
                page,
                limit,
                sortBy,
                sortOrder,
                userId,
                staffId: filterStaffId,
                paymentType,
                dateFrom,
                dateTo,
                itemsCount,
                minItemsCount,
            } = query;

            const canListAll = hasAnyPermission(permissions, [Permission.ORDERS_LIST_ALL]);

            const whereClause: Prisma.OrderWhereInput = {
                deletedAt: null,
                ...(paymentType && { paymentType }),
                ...((dateFrom ?? dateTo) && {
                    createdAt: {
                        ...(dateFrom && { gte: dateFrom }),
                        ...(dateTo && { lte: dateTo }),
                    },
                }),
            };

            // Filter by exact items count
            if (itemsCount !== undefined) {
                const orderGroups = await prisma.orderItem.groupBy({
                    by: ["orderId"],
                    _count: {
                        id: true,
                    },
                    having: {
                        id: {
                            _count: {
                                equals: itemsCount,
                            },
                        },
                    },
                });
                const orderIds = orderGroups.map((g) => g.orderId);
                whereClause.id = { in: orderIds };
            }

            // Filter by minimum items count (for "lists" = orders with >1 item)
            if (minItemsCount !== undefined) {
                const orderGroups = await prisma.orderItem.groupBy({
                    by: ["orderId"],
                    _count: {
                        id: true,
                    },
                    having: {
                        id: {
                            _count: {
                                gte: minItemsCount,
                            },
                        },
                    },
                });
                const orderIds = orderGroups.map((g) => g.orderId);
                // Merge with existing id filter if present
                if (
                    whereClause.id &&
                    typeof whereClause.id !== "number" &&
                    "in" in whereClause.id
                ) {
                    const existingIds = whereClause.id.in as number[];
                    whereClause.id = {
                        in: existingIds.filter((id) => orderIds.includes(id)),
                    };
                } else {
                    whereClause.id = { in: orderIds };
                }
            }

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
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        remaining: true,
                                        costprice: true,
                                    },
                                },
                            },
                        },
                        user: {
                            select: { id: true, fullname: true, phone: true },
                        },
                        staff: { select: { id: true, fullname: true } },
                    },
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            const mapped = orders.map((order) => ({
                ...order,
                items: order.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: item.product
                        ? {
                              ...item.product,
                              price: Number(item.product.price),
                              costprice: Number(item.product.costprice),
                          }
                        : null,
                })),
            }));

            return { success: true, data: { count, orders: mapped } };
        } catch (error) {
            logger.error("Orders: Error in getAllOrders", { error });
            return { success: false, error };
        }
    }

    static async getOrder(
        orderId: number,
        staffId: number,
        permissions: Permission[],
        logger: Logger,
    ): Promise<AdminOrderDetailResponse> {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId, deletedAt: null },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    price: true,
                                    remaining: true,
                                    costprice: true,
                                },
                            },
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

            const mapped = {
                ...order,
                items: order.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: item.product
                        ? {
                              ...item.product,
                              price: Number(item.product.price),
                              costprice: Number(item.product.costprice),
                          }
                        : null,
                })),
            };

            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Orders: Error in getOrder", { orderId, error });
            return { success: false, error };
        }
    }

    static async createOrder(
        orderData: CreateOrderBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<AdminOrderDetailResponse> {
        try {
            const { staffId, user, requestId } = context;
            const mergedItems = orderData.items.reduce<typeof orderData.items>((acc, item) => {
                const existing =
                    item.productId != null
                        ? acc.find((i) => i.productId === item.productId)
                        : undefined;
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    acc.push({ ...item });
                }
                return acc;
            }, []);

            const itemsWithProduct = mergedItems.filter((i) => i.productId != null);
            const productIds = itemsWithProduct.map((i) => i.productId!);

            const products = productIds.length
                ? await prisma.product.findMany({
                      where: {
                          id: { in: productIds },
                          deletedAt: null,
                      },
                      select: { id: true, name: true, price: true, remaining: true },
                  })
                : [];

            if (products.length !== productIds.length) {
                const foundIds = products.map((product) => product.id);
                const missingIds = productIds.filter((id) => !foundIds.includes(id));
                logger.warn("Orders: Products not found or deleted", {
                    missingIds,
                });
                return {
                    success: false,
                    error: `Products not found: ${missingIds.join(", ")}`,
                };
            }

            const productMap = new Map(products.map((product) => [product.id, product]));

            const order = await prisma.$transaction(async (transaction) => {
                const newOrder = await transaction.order.create({
                    data: {
                        userId: orderData.userId ?? null,
                        staffId,
                        paymentType: orderData.paymentType,
                        comment: orderData.comment ?? null,
                        data: (orderData.data as Prisma.JsonObject) ?? {},
                        items: {
                            create: mergedItems.map((item) => {
                                const product =
                                    item.productId != null
                                        ? productMap.get(item.productId)
                                        : undefined;
                                return {
                                    productId: item.productId ?? null,
                                    quantity: item.quantity,
                                    price: product ? product.price : item.price,
                                    data: (item.data as Prisma.JsonObject) ?? null,
                                };
                            }),
                        },
                    },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        remaining: true,
                                        costprice: true,
                                    },
                                },
                            },
                        },
                        user: {
                            select: { id: true, fullname: true, phone: true },
                        },
                        staff: { select: { id: true, fullname: true } },
                    },
                });

                for (const item of mergedItems.filter((i) => i.productId != null)) {
                    const product = productMap.get(item.productId!)!;
                    const previousRemaining = product.remaining;
                    const newRemaining = previousRemaining - item.quantity;

                    await transaction.product.update({
                        where: { id: item.productId! },
                        data: { remaining: { decrement: item.quantity } },
                    });

                    await transaction.productHistory.create({
                        data: {
                            productId: item.productId!,
                            staffId,
                            operation: "INVENTORY_REMOVE",
                            quantity: item.quantity,
                            previousData: { remaining: previousRemaining },
                            newData: { remaining: newRemaining },
                            changeReason: `order:${newOrder.id}`,
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

                return newOrder;
            });

            logger.info("Orders: Order created", {
                orderId: order.id,
                staffId,
                itemCount: order.items.length,
            });

            const mapped = {
                ...order,
                items: order.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: item.product
                        ? {
                              ...item.product,
                              price: Number(item.product.price),
                              costprice: Number(item.product.costprice),
                          }
                        : null,
                })),
            };

            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Orders: Error in createOrder", { error });
            return { success: false, error };
        }
    }

    static async updateOrder(
        orderId: number,
        orderData: UpdateOrderBody,
        context: ServiceContext,
        permissions: Permission[],
        logger: Logger,
    ): Promise<AdminOrderDetailResponse> {
        try {
            const { staffId, user, requestId } = context;

            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId, deletedAt: null },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    remaining: true,
                                    deletedAt: true,
                                },
                            },
                        },
                    },
                },
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

            // Validate new items before transaction
            let productMap:
                | Map<
                      number,
                      { id: number; name: string; price: Prisma.Decimal; remaining: number }
                  >
                | undefined;
            let mergedItems: typeof orderData.items | undefined;

            if (orderData.items) {
                // Build map of old quantities per product for effective stock calculation
                const oldQuantityMap = new Map<number, number>();
                for (const item of existingOrder.items) {
                    if (item.productId != null && item.product && !item.product.deletedAt) {
                        oldQuantityMap.set(
                            item.productId,
                            (oldQuantityMap.get(item.productId) ?? 0) + item.quantity,
                        );
                    }
                }

                mergedItems = orderData.items.reduce<typeof orderData.items>((acc, item) => {
                    const existing =
                        item.productId != null
                            ? acc.find((i) => i.productId === item.productId)
                            : undefined;
                    if (existing) {
                        existing.quantity += item.quantity;
                    } else {
                        acc.push({ ...item });
                    }
                    return acc;
                }, []);

                const itemsWithProduct = mergedItems.filter((i) => i.productId != null);
                const productIds = itemsWithProduct.map((i) => i.productId!);
                const products = productIds.length
                    ? await prisma.product.findMany({
                          where: { id: { in: productIds }, deletedAt: null },
                          select: { id: true, name: true, price: true, remaining: true },
                      })
                    : [];

                if (products.length !== productIds.length) {
                    const foundIds = products.map((p) => p.id);
                    const missingIds = productIds.filter((id) => !foundIds.includes(id));
                    logger.warn("Orders: Products not found for update", { missingIds });
                    return {
                        success: false,
                        error: `Products not found: ${missingIds.join(", ")}`,
                    };
                }

                productMap = new Map(products.map((p) => [p.id, p]));
            }

            const [updatedOrder] = await prisma.$transaction(async (transaction) => {
                // Replace items if provided
                if (orderData.items && productMap) {
                    // 1. Restore old stock (only for items with a product)
                    for (const item of existingOrder.items) {
                        if (item.productId != null && item.product && !item.product.deletedAt) {
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
                                    changeReason: `order_update:${orderId}`,
                                },
                            });
                        }
                    }

                    // 2. Delete old items
                    await transaction.orderItem.deleteMany({
                        where: { orderId },
                    });

                    // 3. Create new items + deduct stock (only for items with a product)
                    for (const item of mergedItems!) {
                        await transaction.orderItem.create({
                            data: {
                                orderId,
                                productId: item.productId ?? null,
                                quantity: item.quantity,
                                price: item.price,
                                data: (item.data as Prisma.JsonObject) ?? null,
                            },
                        });

                        if (item.productId != null) {
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
                                    changeReason: `order_update:${orderId}`,
                                },
                            });
                        }
                    }
                }

                const order = await transaction.order.update({
                    where: { id: orderId },
                    data: {
                        ...(orderData.paymentType && {
                            paymentType: orderData.paymentType,
                        }),
                        ...(orderData.userId !== undefined && {
                            userId: orderData.userId ?? null,
                        }),
                        ...(orderData.comment !== undefined && {
                            comment: orderData.comment,
                        }),
                        ...(orderData.data && {
                            data: orderData.data as Prisma.JsonObject,
                        }),
                    },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        remaining: true,
                                        costprice: true,
                                    },
                                },
                            },
                        },
                        user: {
                            select: {
                                id: true,
                                fullname: true,
                                phone: true,
                            },
                        },
                        staff: { select: { id: true, fullname: true } },
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId, user, logger },
                    {
                        entityType: "order",
                        entityId: orderId,
                        action: "UPDATE",
                        previousData: createOrderSnapshot(existingOrder),
                        newData: createOrderSnapshot(order),
                    },
                );

                return [order];
            });

            logger.info("Orders: Order updated", { orderId, staffId });
            const mapped = {
                ...updatedOrder,
                items: updatedOrder.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: item.product
                        ? {
                              ...item.product,
                              price: Number(item.product.price),
                              costprice: Number(item.product.costprice),
                          }
                        : null,
                })),
            };
            return { success: true, data: mapped };
        } catch (error) {
            logger.error("Orders: Error in updateOrder", { orderId, error });
            return { success: false, error };
        }
    }

    static async deleteOrder(
        orderId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<AdminOrderDeleteResponse> {
        try {
            const { staffId, user, requestId } = context;

            const existingOrder = await prisma.order.findUnique({
                where: { id: orderId, deletedAt: null },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    remaining: true,
                                    deletedAt: true,
                                },
                            },
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
                    if (item.productId != null && item.product && !item.product.deletedAt) {
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
                                changeReason: `order_delete:${orderId}`,
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

    static async restoreOrder(
        orderId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<AdminOrderDeleteResponse> {
        try {
            const { staffId, user, requestId } = context;

            const existingOrder = await prisma.order.findFirst({
                where: { id: orderId, deletedAt: { not: null } },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    remaining: true,
                                    deletedAt: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!existingOrder) {
                logger.warn("Orders: Order not found for restore", { orderId });
                return { success: false, error: "Order not found" };
            }

            await prisma.$transaction(async (transaction) => {
                for (const item of existingOrder.items) {
                    if (item.productId != null && item.product && !item.product.deletedAt) {
                        const previousRemaining = item.product.remaining;
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
                                changeReason: `order_restore:${orderId}`,
                            },
                        });
                    }
                }

                await transaction.order.update({
                    where: { id: orderId },
                    data: { deletedAt: null },
                });

                await auditInTransaction(
                    transaction,
                    { requestId, user, logger },
                    {
                        entityType: "order",
                        entityId: orderId,
                        action: "RESTORE",
                        newData: createOrderSnapshot(existingOrder),
                    },
                );
            });

            logger.info("Orders: Order restored and stock deducted", {
                orderId,
                itemsDeducted: existingOrder.items.length,
                staffId,
            });

            return { success: true, data: { orderId, deleted: false } };
        } catch (error) {
            logger.error("Orders: Error in restoreOrder", { orderId, error });
            return { success: false, error };
        }
    }
}
