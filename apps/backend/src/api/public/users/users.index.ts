import jwt from "@elysiajs/jwt";
import { Elysia, t } from "elysia";

import { TelegramLoginBody, TelegramWebAppAuthBody } from "@jahonbozor/schemas/src/users";

import { AuthService } from "@backend/api/public/auth/auth.service";
import { authMiddleware } from "@backend/lib/middleware";
import { requestContext } from "@backend/lib/request-context";

import { PublicUsersService } from "./users.service";

import type { LogoutResponse, RefreshResponse } from "@jahonbozor/schemas/src/auth";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import type { TelegramAuthResponse } from "@jahonbozor/schemas/src/users";

const authCookieSchema = t.Cookie({
    user_auth: t.Optional(t.String()),
});

const USER_COOKIE_OPTIONS = {
    path: "/api/public/users",
    secure: process.env.NODE_ENV !== "development",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    sameSite: true,
} as const;

export const publicUsers = new Elysia({ prefix: "/users" })
    .use(requestContext)
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET!,
        }),
    )
    .post(
        "/telegram",
        async ({
            body,
            cookie: { user_auth },
            jwt,
            set,
            logger,
            requestId,
        }): Promise<TelegramAuthResponse> => {
            try {
                const result = await PublicUsersService.authenticateWithTelegram(
                    body,
                    jwt,
                    { requestId },
                    logger,
                );

                if (!result.success) {
                    const error = result.error as string;
                    if (
                        error === "Server configuration error" ||
                        error === "Internal Server Error"
                    ) {
                        set.status = 500;
                    } else if (
                        error === "Invalid authentication data" ||
                        error === "Authentication data expired"
                    ) {
                        set.status = 401;
                    } else {
                        set.status = 400;
                    }
                    return { success: false, error };
                }

                const { user, accessToken, refreshToken, refreshTokenExp } = result.data;

                user_auth.set({
                    ...USER_COOKIE_OPTIONS,
                    expires: refreshTokenExp,
                    value: refreshToken,
                });

                return {
                    success: true,
                    data: { user, token: accessToken },
                };
            } catch (error) {
                logger.error("PublicUsers: Unhandled error in POST /telegram", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            body: TelegramLoginBody,
            cookie: authCookieSchema,
        },
    )
    .post(
        "/telegram-webapp",
        async ({
            body,
            cookie: { user_auth },
            jwt,
            set,
            logger,
            requestId,
        }): Promise<TelegramAuthResponse> => {
            try {
                const result = await PublicUsersService.authenticateWithWebApp(
                    body,
                    jwt,
                    { requestId },
                    logger,
                );

                if (!result.success) {
                    const error = result.error as string;
                    if (
                        error === "Server configuration error" ||
                        error === "Internal Server Error"
                    ) {
                        set.status = 500;
                    } else if (error === "Invalid authentication data") {
                        set.status = 401;
                    } else {
                        set.status = 400;
                    }
                    return { success: false, error };
                }

                const { user, accessToken, refreshToken, refreshTokenExp } = result.data;

                user_auth.set({
                    ...USER_COOKIE_OPTIONS,
                    expires: refreshTokenExp,
                    value: refreshToken,
                });

                return {
                    success: true,
                    data: { user, token: accessToken },
                };
            } catch (error) {
                logger.error("PublicUsers: Unhandled error in POST /telegram-webapp", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            body: TelegramWebAppAuthBody,
            cookie: authCookieSchema,
        },
    )
    .post(
        "/refresh",
        async ({ cookie: { user_auth }, jwt, set, logger }): Promise<RefreshResponse> => {
            try {
                if (!user_auth.value) {
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const result = await AuthService.refresh(user_auth.value, jwt, logger, "user");

                if (!result.success) {
                    if (result.error === "Unauthorized") {
                        user_auth.remove();
                        set.status = 401;
                    } else {
                        set.status = 500;
                    }
                    return { success: false, error: result.error };
                }

                const { accessToken, refreshToken, refreshTokenExp } = result.data;

                user_auth.set({
                    ...USER_COOKIE_OPTIONS,
                    expires: refreshTokenExp,
                    value: refreshToken,
                });

                return { success: true, data: { token: accessToken } };
            } catch (error) {
                logger.error("PublicUsers: Unhandled error in POST /refresh", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { cookie: authCookieSchema },
    )
    .post(
        "/logout",
        async ({ cookie: { user_auth }, set, logger }): Promise<LogoutResponse> => {
            try {
                if (!user_auth.value) {
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                await AuthService.logout(user_auth.value, logger, "user");
                user_auth.remove();

                return { success: true, data: null };
            } catch (error) {
                logger.error("PublicUsers: Unhandled error in POST /logout", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { cookie: authCookieSchema },
    )
    .use(authMiddleware)
    .put(
        "/language",
        async ({ body, user, set, logger, requestId }): Promise<ReturnSchema> => {
            try {
                const result = await PublicUsersService.updateLanguage(
                    user.id,
                    body.language,
                    { requestId, user },
                    logger,
                );

                if (!result.success) {
                    set.status = 500;
                }

                return result;
            } catch (error) {
                logger.error("PublicUsers: Unhandled error in PUT /language", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            body: t.Object({ language: t.Union([t.Literal("uz"), t.Literal("ru")]) }),
        },
    );
