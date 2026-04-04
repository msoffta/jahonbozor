import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import {
    CreateTelegramSessionBody,
    TelegramSessionsPagination,
    UpdateTelegramSessionBody,
} from "@jahonbozor/schemas/src/telegram-sessions";

import { authMiddleware } from "@backend/lib/middleware";

import { TelegramSessionsService } from "./telegram-sessions.service";

import type {
    TelegramSessionDetailResponse,
    TelegramSessionQrResponse,
    TelegramSessionQrStatusResponse,
    TelegramSessionsListResponse,
} from "@jahonbozor/schemas/src/telegram-sessions";

const sessionIdParams = t.Object({
    id: t.Numeric(),
});

export const telegramSessions = new Elysia({ prefix: "/telegram-sessions" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<TelegramSessionsListResponse> => {
            try {
                return await TelegramSessionsService.getAllSessions(query, logger);
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in GET /telegram-sessions", {
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_LIST],
            query: TelegramSessionsPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<TelegramSessionDetailResponse> => {
            try {
                const result = await TelegramSessionsService.getSession(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in GET /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_READ],
            params: sessionIdParams,
        },
    )
    .post(
        "/qr/start",
        async ({ body, user, logger, requestId }): Promise<TelegramSessionQrResponse> => {
            try {
                return await TelegramSessionsService.startQrLogin(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in POST /qr/start", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_CREATE],
            body: CreateTelegramSessionBody,
        },
    )
    .get(
        "/qr/status",
        async ({ query, logger }): Promise<TelegramSessionQrStatusResponse> => {
            try {
                return await TelegramSessionsService.getQrStatus(query.token, logger);
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in GET /qr/status", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_CREATE],
            query: t.Object({
                token: t.String(),
            }),
        },
    )
    .post(
        "/qr/password",
        ({ body, logger }): TelegramSessionQrStatusResponse => {
            try {
                return TelegramSessionsService.submitPassword(body.token, body.password, logger);
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in POST /qr/password", {
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_CREATE],
            body: t.Object({
                token: t.String(),
                password: t.String(),
            }),
        },
    )
    .patch(
        "/:id",
        async ({
            params,
            body,
            user,
            set,
            logger,
            requestId,
        }): Promise<TelegramSessionDetailResponse> => {
            try {
                const result = await TelegramSessionsService.updateSession(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in PATCH /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_UPDATE],
            params: sessionIdParams,
            body: UpdateTelegramSessionBody,
        },
    )
    .delete(
        "/:id",
        async ({
            params,
            user,
            set,
            logger,
            requestId,
        }): Promise<TelegramSessionDetailResponse> => {
            try {
                const result = await TelegramSessionsService.deleteSession(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_DELETE],
            params: sessionIdParams,
        },
    )
    .post(
        "/:id/disconnect",
        async ({
            params,
            user,
            set,
            logger,
            requestId,
        }): Promise<TelegramSessionDetailResponse> => {
            try {
                const result = await TelegramSessionsService.disconnectSession(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in POST /:id/disconnect", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_UPDATE],
            params: sessionIdParams,
        },
    )
    .post(
        "/:id/reconnect",
        async ({
            params,
            user,
            set,
            logger,
            requestId,
        }): Promise<TelegramSessionDetailResponse> => {
            try {
                const result = await TelegramSessionsService.reconnectSession(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("TelegramSessions: Unhandled error in POST /:id/reconnect", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.TELEGRAM_SESSIONS_UPDATE],
            params: sessionIdParams,
        },
    );
