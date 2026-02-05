import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Permission } from "@jahonbozor/schemas";
import {
    CreateUserBody,
    TelegramAuthBody,
    UsersPagination,
} from "@jahonbozor/schemas/src/users";
import logger from "@lib/logger";
import { authMiddleware } from "@lib/middleware";
import { Elysia, t } from "elysia";
import { Users } from "./users.service";

const userIdParams = t.Object({
    id: t.Numeric(),
});

export const users = new Elysia({ prefix: "/users" })
    .use(authMiddleware)
    .get(
        "/",
        async ({
            query: { page, limit, searchQuery, includeOrders },
        }): Promise<ReturnSchema> => {
            try {
                return await Users.getAllUsers({
                    page,
                    limit,
                    searchQuery,
                    includeOrders,
                });
            } catch (error) {
                logger.error("Users: Unhandled error in GET /users", { error });
                return {
                    success: false,
                    error,
                };
            }
        },
        {
            permissions: [Permission.USERS_LIST],
            query: UsersPagination,
        },
    )
    .get(
        "/:id",
        async ({ params }): Promise<ReturnSchema> => {
            try {
                return await Users.getUser(params.id);
            } catch (error) {
                logger.error("Users: Unhandled error in GET /users/:id", {
                    id: params.id,
                    error,
                });
                return {
                    success: false,
                    error,
                };
            }
        },
        {
            permissions: [Permission.USERS_READ_ALL],
            params: userIdParams,
        },
    )
    .post(
        "/telegram",
        async ({ body, set }): Promise<ReturnSchema> => {
            try {
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                if (!botToken) {
                    logger.error("Users: TELEGRAM_BOT_TOKEN is not configured");
                    set.status = 500;
                    return {
                        success: false,
                        error: "Server configuration error",
                    };
                }

                const isValidHash = Users.validateTelegramHash(body, botToken);
                if (!isValidHash) {
                    logger.warn("Users: Invalid Telegram hash", {
                        telegramId: body.id,
                    });
                    set.status = 401;
                    return {
                        success: false,
                        error: "Invalid authentication data",
                    };
                }

                return await Users.createOrUpdateFromTelegram(body);
            } catch (error) {
                logger.error("Users: Unhandled error in POST /users/telegram", {
                    telegramId: body.id,
                    error,
                });
                return {
                    success: false,
                    error,
                };
            }
        },
        {
            permissions: [Permission.USERS_CREATE],
            body: TelegramAuthBody,
        },
    )
    .post(
        "/create",
        async ({ body }): Promise<ReturnSchema> => {
            try {
                return await Users.createUser(body);
            } catch (error) {
                logger.error("Users: Unhandled error in POST /users/create", {
                    error,
                });
                return {
                    success: false,
                    error,
                };
            }
        },
        {
            permissions: [Permission.USERS_CREATE],
            body: CreateUserBody,
        },
    )
    .delete(
        "/:id",
        async ({ params }): Promise<ReturnSchema> => {
            try {
                return await Users.deleteUser(params.id);
            } catch (error) {
                logger.error("Users: Unhandled error in DELETE /users/:id", {
                    id: params.id,
                    error,
                });
                return {
                    success: false,
                    error,
                };
            }
        },
        {
            permissions: [Permission.USERS_DELETE],
            params: userIdParams,
        },
    );
