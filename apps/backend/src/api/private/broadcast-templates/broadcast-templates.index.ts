import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import {
    BroadcastTemplatesPagination,
    CreateBroadcastTemplateBody,
    UpdateBroadcastTemplateBody,
} from "@jahonbozor/schemas/src/broadcast-templates";

import { authMiddleware } from "@backend/lib/middleware";

import { BroadcastTemplatesService } from "./broadcast-templates.service";

import type {
    BroadcastTemplateDetailResponse,
    BroadcastTemplatesListResponse,
} from "@jahonbozor/schemas/src/broadcast-templates";

const templateIdParams = t.Object({
    id: t.Numeric(),
});

export const broadcastTemplates = new Elysia({ prefix: "/broadcast-templates" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<BroadcastTemplatesListResponse> => {
            try {
                return await BroadcastTemplatesService.getAllTemplates(query, logger);
            } catch (error) {
                logger.error("BroadcastTemplates: Unhandled error in GET /broadcast-templates", {
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_LIST],
            query: BroadcastTemplatesPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<BroadcastTemplateDetailResponse> => {
            try {
                const result = await BroadcastTemplatesService.getTemplate(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("BroadcastTemplates: Unhandled error in GET /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_READ],
            params: templateIdParams,
        },
    )
    .post(
        "/",
        async ({
            body,
            user,
            set,
            logger,
            requestId,
        }): Promise<BroadcastTemplateDetailResponse> => {
            try {
                const result = await BroadcastTemplatesService.createTemplate(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("BroadcastTemplates: Unhandled error in POST /broadcast-templates", {
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_CREATE],
            body: CreateBroadcastTemplateBody,
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
        }): Promise<BroadcastTemplateDetailResponse> => {
            try {
                const result = await BroadcastTemplatesService.updateTemplate(
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
                logger.error("BroadcastTemplates: Unhandled error in PATCH /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_UPDATE],
            params: templateIdParams,
            body: UpdateBroadcastTemplateBody,
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
        }): Promise<BroadcastTemplateDetailResponse> => {
            try {
                const result = await BroadcastTemplatesService.deleteTemplate(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("BroadcastTemplates: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_DELETE],
            params: templateIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({
            params,
            user,
            set,
            logger,
            requestId,
        }): Promise<BroadcastTemplateDetailResponse> => {
            try {
                const result = await BroadcastTemplatesService.restoreTemplate(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    const error = typeof result.error === "string" ? result.error : "";
                    if (error.includes("not found")) {
                        set.status = 404;
                    } else {
                        set.status = 500;
                    }
                }

                return result;
            } catch (error) {
                logger.error("BroadcastTemplates: Unhandled error in POST /:id/restore", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.BROADCAST_TEMPLATES_DELETE],
            params: templateIdParams,
        },
    );
