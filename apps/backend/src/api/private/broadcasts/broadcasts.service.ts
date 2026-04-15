import { auditInTransaction } from "@backend/lib/audit";
import {
    executeBroadcast,
    pauseBroadcast as pauseBroadcastWorker,
    resumeBroadcast as resumeBroadcastWorker,
} from "@backend/lib/broadcast-worker";
import { prisma } from "@backend/lib/prisma";
import { createBroadcastSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    BroadcastActionResponse,
    BroadcastDetailResponse,
    BroadcastRecipientsPagination,
    BroadcastRecipientsResponse,
    BroadcastsListResponse,
    BroadcastsPagination,
    BroadcastStats,
    CreateBroadcastBody,
    UpdateBroadcastBody,
} from "@jahonbozor/schemas/src/broadcasts";

export abstract class BroadcastsService {
    private static async computeStats(broadcastId: number): Promise<BroadcastStats> {
        const [total, sent, failed, pending] = await Promise.all([
            prisma.broadcastRecipient.count({ where: { broadcastId } }),
            prisma.broadcastRecipient.count({ where: { broadcastId, status: "SENT" } }),
            prisma.broadcastRecipient.count({ where: { broadcastId, status: "FAILED" } }),
            prisma.broadcastRecipient.count({ where: { broadcastId, status: "PENDING" } }),
        ]);
        return { total, sent, failed, pending };
    }

    static async getAllBroadcasts(
        params: BroadcastsPagination,
        logger: Logger,
    ): Promise<BroadcastsListResponse> {
        try {
            const {
                page,
                limit,
                sortBy,
                sortOrder,
                searchQuery,
                status,
                sendVia,
                sessionId,
                includeDeleted,
            } = params;

            const whereClause: Prisma.BroadcastWhereInput = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (searchQuery) {
                whereClause.name = { contains: searchQuery };
            }

            if (status) {
                whereClause.status = status;
            }

            if (sendVia) {
                whereClause.sendVia = sendVia;
            }

            if (sessionId !== undefined) {
                whereClause.sessionId = sessionId;
            }

            const [count, broadcasts] = await prisma.$transaction([
                prisma.broadcast.count({ where: whereClause }),
                prisma.broadcast.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        template: { select: { id: true, name: true } },
                        session: { select: { id: true, name: true } },
                    },
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            // Compute stats for each broadcast
            const broadcastsWithStats = await Promise.all(
                broadcasts.map(async (broadcast) => {
                    const stats = await this.computeStats(broadcast.id);
                    return { ...broadcast, stats };
                }),
            );

            return {
                success: true,
                data: { count, broadcasts: broadcastsWithStats },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in getAllBroadcasts", { params, error });
            return { success: false, error };
        }
    }

    static async getBroadcast(
        broadcastId: number,
        logger: Logger,
    ): Promise<BroadcastDetailResponse> {
        try {
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
                include: {
                    template: { select: { id: true, name: true } },
                    session: { select: { id: true, name: true } },
                },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            const stats = await this.computeStats(broadcastId);

            return { success: true, data: { ...broadcast, stats } };
        } catch (error) {
            logger.error("Broadcasts: Error in getBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async createBroadcast(
        body: CreateBroadcastBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastDetailResponse> {
        try {
            const {
                name,
                content,
                media,
                buttons,
                templateId,
                sendVia,
                sessionId,
                recipientUserIds,
                scheduledAt,
            } = body;

            // Validate sessionId requirement for SESSION mode
            if (sendVia === "SESSION" && !sessionId) {
                logger.warn("Broadcasts: sessionId is required when sendVia is SESSION");
                return { success: false, error: "sessionId is required when sendVia is SESSION" };
            }

            // Look up recipients based on sendVia mode
            const users = await prisma.users.findMany({
                where: {
                    id: { in: recipientUserIds },
                    deletedAt: null,
                    // BOT mode requires telegramId; SESSION accepts all (contacts can be added)
                    ...(sendVia === "BOT" ? { telegramId: { not: null } } : {}),
                },
                select: { id: true, telegramId: true },
            });

            if (users.length === 0) {
                const errorMsg =
                    sendVia === "BOT"
                        ? "No valid recipients with Telegram ID found"
                        : "No valid recipients found";
                logger.warn(`Broadcasts: ${errorMsg}`, { recipientUserIds });
                return { success: false, error: errorMsg };
            }

            const broadcastStatus = scheduledAt ? "SCHEDULED" : "DRAFT";

            const [newBroadcast] = await prisma.$transaction(async (transaction) => {
                const broadcast = await transaction.broadcast.create({
                    data: {
                        name,
                        content: content ?? null,
                        media: media ?? undefined,
                        buttons: buttons ?? undefined,
                        templateId: templateId ?? null,
                        sendVia,
                        sessionId: sendVia === "BOT" ? null : sessionId!,
                        status: broadcastStatus,
                        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                        createdById: context.staffId,
                    },
                    include: {
                        template: { select: { id: true, name: true } },
                        session: { select: { id: true, name: true } },
                    },
                });

                // Create recipient records
                await transaction.broadcastRecipient.createMany({
                    data: users.map((user) => ({
                        broadcastId: broadcast.id,
                        userId: user.id,
                        telegramId: user.telegramId ? String(user.telegramId) : "",
                        status: "PENDING" as const,
                    })),
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcast",
                        entityId: broadcast.id,
                        action: "CREATE",
                        newData: createBroadcastSnapshot(broadcast),
                    },
                );

                return [broadcast];
            });

            logger.info("Broadcasts: Broadcast created", {
                broadcastId: newBroadcast.id,
                name,
                recipientCount: users.length,
                status: broadcastStatus,
                staffId: context.staffId,
            });

            const stats = await this.computeStats(newBroadcast.id);

            return { success: true, data: { ...newBroadcast, stats } };
        } catch (error) {
            logger.error("Broadcasts: Error in createBroadcast", { body, error });
            return { success: false, error };
        }
    }

    static async updateBroadcast(
        broadcastId: number,
        body: UpdateBroadcastBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastDetailResponse> {
        try {
            const existingBroadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!existingBroadcast) {
                logger.warn("Broadcasts: Broadcast not found for update", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            if (existingBroadcast.status !== "DRAFT") {
                logger.warn("Broadcasts: Cannot update broadcast that is not in DRAFT status", {
                    broadcastId,
                    status: existingBroadcast.status,
                });
                return { success: false, error: "Can only update broadcasts in DRAFT status" };
            }

            const updateData: Prisma.BroadcastUpdateInput = {};

            if (body.name !== undefined) updateData.name = body.name;
            if (body.content !== undefined) updateData.content = body.content;
            if (body.media !== undefined) updateData.media = body.media;
            if (body.buttons !== undefined) updateData.buttons = body.buttons;
            if (body.templateId !== undefined) {
                updateData.template =
                    body.templateId === null
                        ? { disconnect: true }
                        : { connect: { id: body.templateId } };
            }
            if (body.sessionId !== undefined) {
                updateData.session = { connect: { id: body.sessionId } };
            }
            if (body.scheduledAt !== undefined) {
                updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
            }

            const [updatedBroadcast] = await prisma.$transaction(async (transaction) => {
                const broadcast = await transaction.broadcast.update({
                    where: { id: broadcastId },
                    data: updateData,
                    include: {
                        template: { select: { id: true, name: true } },
                        session: { select: { id: true, name: true } },
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcast",
                        entityId: broadcastId,
                        action: "UPDATE",
                        previousData: createBroadcastSnapshot(existingBroadcast),
                        newData: createBroadcastSnapshot(broadcast),
                    },
                );

                return [broadcast];
            });

            logger.info("Broadcasts: Broadcast updated", { broadcastId, staffId: context.staffId });

            const stats = await this.computeStats(broadcastId);

            return { success: true, data: { ...updatedBroadcast, stats } };
        } catch (error) {
            logger.error("Broadcasts: Error in updateBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async deleteBroadcast(
        broadcastId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastDetailResponse> {
        try {
            const existingBroadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!existingBroadcast) {
                logger.warn("Broadcasts: Broadcast not found for delete", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            const [deletedBroadcast] = await prisma.$transaction(async (transaction) => {
                const broadcast = await transaction.broadcast.update({
                    where: { id: broadcastId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcast",
                        entityId: broadcastId,
                        action: "DELETE",
                        previousData: createBroadcastSnapshot(existingBroadcast),
                    },
                );

                return [broadcast];
            });

            logger.info("Broadcasts: Broadcast deleted", {
                broadcastId,
                name: deletedBroadcast.name,
                staffId: context.staffId,
            });

            return { success: true, data: deletedBroadcast };
        } catch (error) {
            logger.error("Broadcasts: Error in deleteBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async getRecipients(
        broadcastId: number,
        params: BroadcastRecipientsPagination,
        logger: Logger,
    ): Promise<BroadcastRecipientsResponse> {
        try {
            const { page, limit, sortBy, sortOrder, status } = params;

            // Verify broadcast exists
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
                select: { id: true },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found for recipients", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            const whereClause: Prisma.BroadcastRecipientWhereInput = { broadcastId };

            if (status) {
                whereClause.status = status;
            }

            const [count, recipients] = await prisma.$transaction([
                prisma.broadcastRecipient.count({ where: whereClause }),
                prisma.broadcastRecipient.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        user: { select: { id: true, fullname: true } },
                    },
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            return {
                success: true,
                data: { count, recipients },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in getRecipients", { broadcastId, params, error });
            return { success: false, error };
        }
    }

    static async sendBroadcast(
        broadcastId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastActionResponse> {
        try {
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found for send", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            if (broadcast.status !== "DRAFT" && broadcast.status !== "SCHEDULED") {
                logger.warn("Broadcasts: Cannot send broadcast that is not DRAFT or SCHEDULED", {
                    broadcastId,
                    status: broadcast.status,
                });
                return {
                    success: false,
                    error: "Can only send broadcasts in DRAFT or SCHEDULED status",
                };
            }

            if (broadcast.scheduledAt) {
                // Set to SCHEDULED and let the worker pick it up
                await prisma.broadcast.update({
                    where: { id: broadcastId },
                    data: { status: "SCHEDULED" },
                });

                logger.info("Broadcasts: Broadcast scheduled", {
                    broadcastId,
                    scheduledAt: broadcast.scheduledAt,
                    staffId: context.staffId,
                });

                return {
                    success: true,
                    data: { broadcastId, status: "SCHEDULED" },
                };
            }

            // Start immediately
            void executeBroadcast(broadcastId, logger);

            logger.info("Broadcasts: Broadcast send started", {
                broadcastId,
                staffId: context.staffId,
            });

            return {
                success: true,
                data: { broadcastId, status: "SENDING" },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in sendBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async pauseBroadcast(
        broadcastId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastActionResponse> {
        try {
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found for pause", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            if (broadcast.status !== "SENDING") {
                logger.warn("Broadcasts: Cannot pause broadcast that is not SENDING", {
                    broadcastId,
                    status: broadcast.status,
                });
                return {
                    success: false,
                    error: "Can only pause broadcasts that are currently sending",
                };
            }

            const paused = pauseBroadcastWorker(broadcastId);
            if (!paused) {
                logger.warn("Broadcasts: Broadcast is not actively running", { broadcastId });
                return { success: false, error: "Broadcast is not actively running" };
            }

            logger.info("Broadcasts: Broadcast paused", {
                broadcastId,
                staffId: context.staffId,
            });

            return {
                success: true,
                data: { broadcastId, status: "PAUSED" },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in pauseBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async resumeBroadcast(
        broadcastId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastActionResponse> {
        try {
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found for resume", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            if (broadcast.status !== "PAUSED") {
                logger.warn("Broadcasts: Cannot resume broadcast that is not PAUSED", {
                    broadcastId,
                    status: broadcast.status,
                });
                return { success: false, error: "Can only resume broadcasts that are paused" };
            }

            resumeBroadcastWorker(broadcastId, logger);

            logger.info("Broadcasts: Broadcast resumed", {
                broadcastId,
                staffId: context.staffId,
            });

            return {
                success: true,
                data: { broadcastId, status: "SENDING" },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in resumeBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }

    static async retryBroadcast(
        broadcastId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<BroadcastActionResponse> {
        try {
            const broadcast = await prisma.broadcast.findFirst({
                where: { id: broadcastId, deletedAt: null },
            });

            if (!broadcast) {
                logger.warn("Broadcasts: Broadcast not found for retry", { broadcastId });
                return { success: false, error: "Broadcast not found" };
            }

            if (broadcast.status !== "COMPLETED" && broadcast.status !== "FAILED") {
                logger.warn("Broadcasts: Cannot retry broadcast that is not COMPLETED or FAILED", {
                    broadcastId,
                    status: broadcast.status,
                });
                return {
                    success: false,
                    error: "Can only retry broadcasts that are completed or failed",
                };
            }

            // Reset all FAILED recipients to PENDING and set broadcast status to DRAFT
            await prisma.$transaction(async (transaction) => {
                await transaction.broadcastRecipient.updateMany({
                    where: { broadcastId, status: "FAILED" },
                    data: { status: "PENDING", errorMessage: null, sentAt: null },
                });

                await transaction.broadcast.update({
                    where: { id: broadcastId },
                    data: {
                        status: "DRAFT",
                        startedAt: null,
                        completedAt: null,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "broadcast",
                        entityId: broadcastId,
                        action: "UPDATE",
                        previousData: createBroadcastSnapshot(broadcast),
                        newData: {
                            ...createBroadcastSnapshot(broadcast),
                            status: "DRAFT",
                        },
                    },
                );
            });

            logger.info("Broadcasts: Broadcast retry prepared", {
                broadcastId,
                staffId: context.staffId,
            });

            return {
                success: true,
                data: { broadcastId, status: "DRAFT" },
            };
        } catch (error) {
            logger.error("Broadcasts: Error in retryBroadcast", { broadcastId, error });
            return { success: false, error };
        }
    }
}
