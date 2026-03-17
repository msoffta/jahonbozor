import jwt from "@elysiajs/jwt";
import { Elysia, t } from "elysia";

import { TelegramLoginBody } from "@jahonbozor/schemas/src/users";

import { authMiddleware } from "@backend/lib/middleware";
import { requestContext } from "@backend/lib/request-context";

import { PublicUsersService } from "./users.service";

import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import type { TelegramAuthResponse } from "@jahonbozor/schemas/src/users";

const authCookieSchema = t.Cookie({
    auth: t.Optional(t.String()),
});

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
            cookie: { auth },
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

                // Set refresh token cookie (HTTP concern — stays in route handler)
                auth.set({
                    path: "/api/public/auth",
                    secure: process.env.NODE_ENV !== "development",
                    httpOnly: true,
                    expires: refreshTokenExp,
                    maxAge: 30 * 24 * 60 * 60,
                    value: refreshToken,
                    sameSite: true,
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
