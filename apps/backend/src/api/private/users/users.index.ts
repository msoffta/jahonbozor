import { Elysia, t } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { CreateUserBody, UpdateUserBody, UsersPagination } from "@jahonbozor/schemas/src/users";

import { authMiddleware } from "@backend/lib/middleware";

import { UsersService } from "./users.service";

import type {
    AdminUserDetailResponse,
    AdminUsersListResponse,
} from "@jahonbozor/schemas/src/users";

const userIdParams = t.Object({
    id: t.Numeric(),
});

export const users = new Elysia({ prefix: "/users" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<AdminUsersListResponse> => {
            try {
                return await UsersService.getAllUsers(query, logger);
            } catch (error) {
                logger.error("Users: Unhandled error in GET /users", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_LIST],
            query: UsersPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, set, logger }): Promise<AdminUserDetailResponse> => {
            try {
                const result = await UsersService.getUser(params.id, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Users: Unhandled error in GET /users/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_READ_ALL],
            params: userIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set, logger, requestId }): Promise<AdminUserDetailResponse> => {
            try {
                const result = await UsersService.createUser(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );
                if (!result.success) set.status = 400;
                return result;
            } catch (error) {
                logger.error("Users: Unhandled error in POST /users", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_CREATE],
            body: CreateUserBody,
        },
    )
    .put(
        "/:id",
        async ({
            params,
            body,
            user,
            set,
            logger,
            requestId,
        }): Promise<AdminUserDetailResponse> => {
            try {
                const result = await UsersService.updateUser(
                    params.id,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = result.error === "User not found" ? 404 : 400;
                }

                return result;
            } catch (error) {
                logger.error("Users: Unhandled error in PUT /users/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_UPDATE_ALL],
            params: userIdParams,
            body: UpdateUserBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<AdminUserDetailResponse> => {
            try {
                const result = await UsersService.deleteUser(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = result.error === "User not found" ? 404 : 400;
                }

                return result;
            } catch (error) {
                logger.error("Users: Unhandled error in DELETE /users/:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_DELETE],
            params: userIdParams,
        },
    )
    .post(
        "/:id/restore",
        async ({ params, user, set, logger, requestId }): Promise<AdminUserDetailResponse> => {
            try {
                const result = await UsersService.restoreUser(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = result.error === "User not found" ? 404 : 400;
                }

                return result;
            } catch (error) {
                logger.error("Users: Unhandled error in POST /users/:id/restore", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.USERS_DELETE],
            params: userIdParams,
        },
    );
