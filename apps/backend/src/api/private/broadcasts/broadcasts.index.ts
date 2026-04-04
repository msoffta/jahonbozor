import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import {
    BroadcastRecipientsPagination,
    BroadcastsPagination,
    CreateBroadcastBody,
    UpdateBroadcastBody,
} from "@jahonbozor/schemas/src/broadcasts";

import { authMiddleware } from "@backend/lib/middleware";

import { BroadcastsService } from "./broadcasts.service";

import type {
    BroadcastActionResponse,
    BroadcastDetailResponse,
    BroadcastRecipientsResponse,
    BroadcastsListResponse,
} from "@jahonbozor/schemas/src/broadcasts";

const broadcastIdParams = t.Object({
    id: t.Numeric(),
});

export const broadcasts = new Elysia({ prefix: "/broadcasts" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<BroadcastsListResponse> => {
            try {
                return await BroadcastsService.getAllBroadcasts(query, logger);
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in GET /broadcasts", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_LIST],
            query: BroadcastsPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<BroadcastDetailResponse> => {
            try {
                const result = await BroadcastsService.getBroadcast(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in GET /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_READ],
            params: broadcastIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set, logger, requestId }): Promise<BroadcastDetailResponse> => {
            try {
                const result = await BroadcastsService.createBroadcast(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in POST /broadcasts", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_CREATE],
            body: CreateBroadcastBody,
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
        }): Promise<BroadcastDetailResponse> => {
            try {
                const result = await BroadcastsService.updateBroadcast(
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
                logger.error("Broadcasts: Unhandled error in PATCH /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_UPDATE],
            params: broadcastIdParams,
            body: UpdateBroadcastBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<BroadcastDetailResponse> => {
            try {
                const result = await BroadcastsService.deleteBroadcast(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_DELETE],
            params: broadcastIdParams,
        },
    )
    .get(
        "/:id/recipients",
        async ({ params, query, set, logger }): Promise<BroadcastRecipientsResponse> => {
            try {
                const result = await BroadcastsService.getRecipients(params.id, query, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in GET /:id/recipients", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_READ],
            params: broadcastIdParams,
            query: BroadcastRecipientsPagination,
        },
    )
    .post(
        "/:id/send",
        async ({ params, user, set, logger, requestId }): Promise<BroadcastActionResponse> => {
            try {
                const result = await BroadcastsService.sendBroadcast(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in POST /:id/send", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_SEND],
            params: broadcastIdParams,
        },
    )
    .post(
        "/:id/pause",
        async ({ params, user, set, logger, requestId }): Promise<BroadcastActionResponse> => {
            try {
                const result = await BroadcastsService.pauseBroadcast(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in POST /:id/pause", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_SEND],
            params: broadcastIdParams,
        },
    )
    .post(
        "/:id/resume",
        async ({ params, user, set, logger, requestId }): Promise<BroadcastActionResponse> => {
            try {
                const result = await BroadcastsService.resumeBroadcast(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in POST /:id/resume", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_SEND],
            params: broadcastIdParams,
        },
    )
    .post(
        "/:id/retry",
        async ({ params, user, set, logger, requestId }): Promise<BroadcastActionResponse> => {
            try {
                const result = await BroadcastsService.retryBroadcast(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Broadcasts: Unhandled error in POST /:id/retry", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCASTS_SEND],
            params: broadcastIdParams,
        },
    );
