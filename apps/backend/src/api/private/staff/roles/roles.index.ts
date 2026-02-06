import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import { CreateRoleBody, UpdateRoleBody } from "@jahonbozor/schemas/src/roles";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { RolesService } from "./roles.service";

const roleIdParams = t.Object({
    id: t.Numeric(),
});

const RolesPagination = t.Object({
    page: t.Numeric({ default: 1 }),
    limit: t.Numeric({ default: 20 }),
    searchQuery: t.Optional(t.String()),
    includeStaffCount: t.Optional(t.BooleanString()),
});

const RoleQueryParams = t.Object({
    includeStaffCount: t.Optional(t.BooleanString()),
});

export const roles = new Elysia({ prefix: "/roles" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<ReturnSchema> => {
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
        "/:id",
        async ({ params, query, set, logger }): Promise<ReturnSchema> => {
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
                logger.error("Roles: Unhandled error in GET /:id", { id: params.id, error });
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
        "/",
        async ({ body, user, set, logger, requestId }): Promise<ReturnSchema> => {
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
        "/:id",
        async ({ params, body, user, set, logger, requestId }): Promise<ReturnSchema> => {
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
                logger.error("Roles: Unhandled error in PATCH /:id", { id: params.id, error });
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
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<ReturnSchema> => {
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
                logger.error("Roles: Unhandled error in DELETE /:id", { id: params.id, error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.ROLES_DELETE],
            params: roleIdParams,
        },
    );
