import { auditInTransaction } from "@backend/lib/audit";
import {
    connectClient,
    disconnectClient,
    initQrLogin,
    pollQrStatus,
    submitQrPassword,
} from "@backend/lib/mtproto";
import { prisma } from "@backend/lib/prisma";
import { createTelegramSessionSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    CreateTelegramSessionBody,
    TelegramSessionDetailResponse,
    TelegramSessionQrResponse,
    TelegramSessionQrStatusResponse,
    TelegramSessionsListResponse,
    TelegramSessionsPagination,
    UpdateTelegramSessionBody,
} from "@jahonbozor/schemas/src/telegram-sessions";

/** Fields safe to expose — never include sessionString, apiId, apiHash */
const SAFE_SELECT = {
    id: true,
    name: true,
    phone: true,
    status: true,
    lastUsedAt: true,
    deletedAt: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TelegramSessionSelect;

export abstract class TelegramSessionsService {
    static async getAllSessions(
        params: TelegramSessionsPagination,
        logger: Logger,
    ): Promise<TelegramSessionsListResponse> {
        try {
            const { page, limit, sortBy, sortOrder, searchQuery, status, includeDeleted } = params;

            const whereClause: Prisma.TelegramSessionWhereInput = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (status) {
                whereClause.status = status;
            }

            if (searchQuery) {
                whereClause.name = { contains: searchQuery, mode: "insensitive" };
            }

            const [count, sessions] = await prisma.$transaction([
                prisma.telegramSession.count({ where: whereClause }),
                prisma.telegramSession.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    select: SAFE_SELECT,
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            return {
                success: true,
                data: { count, sessions },
            };
        } catch (error) {
            logger.error("TelegramSessions: Error in getAllSessions", { params, error });
            return { success: false, error };
        }
    }

    static async getSession(
        sessionId: number,
        logger: Logger,
    ): Promise<TelegramSessionDetailResponse> {
        try {
            const session = await prisma.telegramSession.findFirst({
                where: { id: sessionId, deletedAt: null },
                select: SAFE_SELECT,
            });

            if (!session) {
                logger.warn("TelegramSessions: Session not found", { sessionId });
                return { success: false, error: "Session not found" };
            }

            return { success: true, data: session };
        } catch (error) {
            logger.error("TelegramSessions: Error in getSession", { sessionId, error });
            return { success: false, error };
        }
    }

    static async startQrLogin(
        body: CreateTelegramSessionBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<TelegramSessionQrResponse> {
        try {
            const result = await initQrLogin(
                {
                    name: body.name,
                    phone: body.phone,
                    apiId: body.apiId,
                    apiHash: body.apiHash,
                },
                logger,
            );

            logger.info("TelegramSessions: QR login started", {
                name: body.name,
                phone: body.phone,
                staffId: context.staffId,
            });

            return { success: true, data: result };
        } catch (error) {
            logger.error("TelegramSessions: Error in startQrLogin", { body, error });
            return { success: false, error };
        }
    }

    static async getQrStatus(
        token: string,
        logger: Logger,
    ): Promise<TelegramSessionQrStatusResponse> {
        try {
            const result = await pollQrStatus(token, logger);

            return { success: true, data: result };
        } catch (error) {
            logger.error("TelegramSessions: Error in getQrStatus", { token, error });
            return { success: false, error };
        }
    }

    static submitPassword(
        token: string,
        password: string,
        logger: Logger,
    ): TelegramSessionQrStatusResponse {
        try {
            const submitted = submitQrPassword(token, password);
            if (!submitted) {
                logger.warn("TelegramSessions: Password submit failed — invalid token or state", {
                    token,
                });
                return { success: false, error: "Invalid token or not awaiting password" };
            }

            logger.info("TelegramSessions: 2FA password submitted", { token });
            return { success: true, data: { status: "waiting" } };
        } catch (error) {
            logger.error("TelegramSessions: Error in submitPassword", { token, error });
            return { success: false, error };
        }
    }

    static async updateSession(
        sessionId: number,
        body: UpdateTelegramSessionBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<TelegramSessionDetailResponse> {
        try {
            const existingSession = await prisma.telegramSession.findFirst({
                where: { id: sessionId, deletedAt: null },
            });

            if (!existingSession) {
                logger.warn("TelegramSessions: Session not found for update", { sessionId });
                return { success: false, error: "Session not found" };
            }

            const [updatedSession] = await prisma.$transaction(async (transaction) => {
                const session = await transaction.telegramSession.update({
                    where: { id: sessionId },
                    data: body,
                    select: SAFE_SELECT,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "telegramSession",
                        entityId: sessionId,
                        action: "UPDATE",
                        previousData: createTelegramSessionSnapshot(existingSession),
                        newData: createTelegramSessionSnapshot({
                            ...existingSession,
                            ...body,
                        }),
                    },
                );

                return [session];
            });

            logger.info("TelegramSessions: Session updated", {
                sessionId,
                staffId: context.staffId,
            });

            return { success: true, data: updatedSession };
        } catch (error) {
            logger.error("TelegramSessions: Error in updateSession", { sessionId, error });
            return { success: false, error };
        }
    }

    static async deleteSession(
        sessionId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<TelegramSessionDetailResponse> {
        try {
            const existingSession = await prisma.telegramSession.findFirst({
                where: { id: sessionId, deletedAt: null },
            });

            if (!existingSession) {
                logger.warn("TelegramSessions: Session not found for delete", { sessionId });
                return { success: false, error: "Session not found" };
            }

            // Disconnect the client before soft-deleting
            try {
                await disconnectClient(sessionId, logger);
            } catch (disconnectError) {
                logger.warn("TelegramSessions: Failed to disconnect client during delete", {
                    sessionId,
                    error: disconnectError,
                });
            }

            const [deletedSession] = await prisma.$transaction(async (transaction) => {
                const session = await transaction.telegramSession.update({
                    where: { id: sessionId },
                    data: { deletedAt: new Date(), status: "DISCONNECTED" },
                    select: SAFE_SELECT,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "telegramSession",
                        entityId: sessionId,
                        action: "DELETE",
                        previousData: createTelegramSessionSnapshot(existingSession),
                    },
                );

                return [session];
            });

            logger.info("TelegramSessions: Session deleted", {
                sessionId,
                name: existingSession.name,
                staffId: context.staffId,
            });

            return { success: true, data: deletedSession };
        } catch (error) {
            logger.error("TelegramSessions: Error in deleteSession", { sessionId, error });
            return { success: false, error };
        }
    }

    static async disconnectSession(
        sessionId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<TelegramSessionDetailResponse> {
        try {
            const existingSession = await prisma.telegramSession.findFirst({
                where: { id: sessionId, deletedAt: null },
            });

            if (!existingSession) {
                logger.warn("TelegramSessions: Session not found for disconnect", { sessionId });
                return { success: false, error: "Session not found" };
            }

            await disconnectClient(sessionId, logger);

            const [updatedSession] = await prisma.$transaction(async (transaction) => {
                const session = await transaction.telegramSession.update({
                    where: { id: sessionId },
                    data: { status: "DISCONNECTED" },
                    select: SAFE_SELECT,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "telegramSession",
                        entityId: sessionId,
                        action: "UPDATE",
                        previousData: createTelegramSessionSnapshot(existingSession),
                        newData: createTelegramSessionSnapshot({
                            ...existingSession,
                            status: "DISCONNECTED",
                        }),
                    },
                );

                return [session];
            });

            logger.info("TelegramSessions: Session disconnected", {
                sessionId,
                staffId: context.staffId,
            });

            return { success: true, data: updatedSession };
        } catch (error) {
            logger.error("TelegramSessions: Error in disconnectSession", { sessionId, error });
            return { success: false, error };
        }
    }

    static async reconnectSession(
        sessionId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<TelegramSessionDetailResponse> {
        try {
            const existingSession = await prisma.telegramSession.findFirst({
                where: { id: sessionId, deletedAt: null },
            });

            if (!existingSession) {
                logger.warn("TelegramSessions: Session not found for reconnect", { sessionId });
                return { success: false, error: "Session not found" };
            }

            await connectClient(sessionId, logger);

            const [updatedSession] = await prisma.$transaction(async (transaction) => {
                const session = await transaction.telegramSession.update({
                    where: { id: sessionId },
                    data: { status: "ACTIVE", lastUsedAt: new Date() },
                    select: SAFE_SELECT,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "telegramSession",
                        entityId: sessionId,
                        action: "UPDATE",
                        previousData: createTelegramSessionSnapshot(existingSession),
                        newData: createTelegramSessionSnapshot({
                            ...existingSession,
                            status: "ACTIVE",
                        }),
                    },
                );

                return [session];
            });

            logger.info("TelegramSessions: Session reconnected", {
                sessionId,
                staffId: context.staffId,
            });

            return { success: true, data: updatedSession };
        } catch (error) {
            logger.error("TelegramSessions: Error in reconnectSession", { sessionId, error });
            return { success: false, error };
        }
    }
}
