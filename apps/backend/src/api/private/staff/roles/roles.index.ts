import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { CreateRoleBody, UpdateRoleBody } from "@jahonbozor/schemas/src/roles";

import { authMiddleware } from "@backend/lib/middleware";

import { RolesService } from "./roles.service";

import type { RoleDetailResponse, RolesListResponse } from "@jahonbozor/schemas/src/roles";

const roleIdParams = t.Object({
    id: t.Numeric(),
});

const RolesPagination = t.Object({
    page: t.Numeric({ default: 1 }),
    limit: t.Numeric({ default: 20 }),
    sortBy: t.String({ default: "id" }),
    sortOrder: t.Union([t.Literal("asc"), t.Literal("desc")], { default: "asc" }),
    searchQuery: t.Optional(t.String()),
    includeStaffCount: t.Optional(t.BooleanString()),
});

const RoleQueryParams = t.Object({
    includeStaffCount: t.Optional(t.BooleanString()),
});

export const roles = new Elysia()
    .use(authMiddleware)
    .get(
        "/roles",
        async ({ query, logger }): Promise<RolesListResponse> => {
            try {
                return await RolesService.getAllRoles(query, logger);
            } catch (error) {
                logger.error("Roles: Unhandled error in GET /roles", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_LIST],
            query: RolesPagination,
        },
    )
    .get(
        "/roles/:id",
        async ({ params, query, set, logger }): Promise<RoleDetailResponse> => {
            try {
                const result = await RolesService.getRole(
                    params.id,
                    query.includeStaffCount,
                    logger,
                );

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Roles: Unhandled error in GET /roles/:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_READ],
            params: roleIdParams,
            query: RoleQueryParams,
        },
    )
    .post(
        "/roles",
        async ({ body, user, set, logger, requestId }): Promise<RoleDetailResponse> => {
            try {
                const result = await RolesService.createRole(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Roles: Unhandled error in POST /roles", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_CREATE],
            body: CreateRoleBody,
        },
    )
    .patch(
        "/roles/:id",
        async ({ params, body, user, set, logger, requestId }): Promise<RoleDetailResponse> => {
            try {
                const result = await RolesService.updateRole(
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
                logger.error("Roles: Unhandled error in PATCH /roles/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_UPDATE],
            params: roleIdParams,
            body: UpdateRoleBody,
        },
    )
    .delete(
        "/roles/:id",
        async ({ params, user, set, logger, requestId }): Promise<RoleDetailResponse> => {
            try {
                const result = await RolesService.deleteRole(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Roles: Unhandled error in DELETE /roles/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_DELETE],
            params: roleIdParams,
        },
    )
    .post(
        "/roles/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<RoleDetailResponse> => {
            try {
                const result = await RolesService.restoreRole(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    const error = typeof result.error === "string" ? result.error : "";
                    if (error.includes("not found")) {
                        set.status = 404;
                    } else if (error.includes("not deleted")) {
                        set.status = 400;
                    } else {
                        set.status = 500;
                    }
                }

                return result;
            } catch (error) {
                logger.error("Roles: Unhandled error in POST /roles/:id/restore", {
                    id: params.id,
                    error,
                });
                set.status = 500;
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_DELETE],
            params: roleIdParams,
        },
    );
