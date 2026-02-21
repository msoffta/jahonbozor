import { TelegramLoginBody } from "@jahonbozor/schemas/src/users";
import type { TelegramAuthResponse } from "@jahonbozor/schemas/src/users";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Elysia, t } from "elysia";
import jwt from "@elysiajs/jwt";
import dayjs from "dayjs";
import { requestContext } from "@backend/lib/request-context";
import { authMiddleware } from "@backend/lib/middleware";
import { prisma } from "@backend/lib/prisma";
import { Users } from "@backend/api/private/users/users.service";
import Auth from "@backend/api/public/auth/auth.service";
import { sendContactRequest } from "@backend/lib/telegram";

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
        async ({ body, cookie: { auth }, jwt, set, logger, requestId }): Promise<TelegramAuthResponse> => {
            try {
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                if (!botToken) {
                    logger.error("Users: TELEGRAM_BOT_TOKEN is not configured");
                    set.status = 500;
                    return { success: false, error: "Server configuration error" };
                }

                // Extract language before hash validation — it's not part of Telegram's signed data
                const { language, ...telegramData } = body;

                const isValidHash = Users.validateTelegramHash(telegramData, botToken);
                if (!isValidHash) {
                    logger.warn("Users: Invalid Telegram hash", { telegramId: telegramData.id });
                    set.status = 401;
                    return { success: false, error: "Invalid authentication data" };
                }

                // Check if auth_date is not too old (5 minutes max)
                const authTimestamp = telegramData.auth_date * 1000;
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                if (authTimestamp < fiveMinutesAgo) {
                    logger.warn("Users: Telegram auth data expired", {
                        telegramId: telegramData.id,
                        authDate: telegramData.auth_date,
                    });
                    set.status = 401;
                    return { success: false, error: "Authentication data expired" };
                }

                const result = await Users.createOrUpdateFromTelegram(telegramData, logger, undefined, requestId, language);

                if (!result.success) {
                    set.status = 400;
                    return { success: false, error: result.error };
                }

                const user = result.data;

                // Generate JWT tokens for the user
                const refreshTokenExp = dayjs().add(30, "day");

                const refreshToken = await jwt.sign({
                    id: user.id,
                    type: "user",
                    exp: refreshTokenExp.unix(),
                });

                const accessToken = await jwt.sign({
                    id: user.id,
                    fullname: user.fullname,
                    username: user.username,
                    phone: user.phone,
                    telegramId: String(user.telegramId),
                    type: "user",
                    exp: dayjs().add(15, "minute").unix(),
                });

                // Save refresh token to database
                const isRefreshTokenSaved = await Auth.saveRefreshToken(
                    { token: refreshToken, exp: refreshTokenExp.toDate(), userId: user.id },
                    logger,
                );

                if (!isRefreshTokenSaved) {
                    logger.error("Users: Refresh token not saved", { userId: user.id });
                    set.status = 500;
                    return { success: false, error: "Internal Server Error" };
                }

                // Set refresh token cookie
                auth.set({
                    path: "/api/public/auth",
                    secure: process.env.NODE_ENV !== "development",
                    httpOnly: true,
                    expires: refreshTokenExp.toDate(),
                    maxAge: 30 * 24 * 60 * 60,
                    value: refreshToken,
                    sameSite: true,
                });

                logger.info("Users: Telegram authentication successful", {
                    userId: user.id,
                    telegramId: telegramData.id,
                });

                // If user has no phone, send Telegram bot message requesting contact in user's language
                if (!user.phone) {
                    sendContactRequest(String(telegramData.id), user.language, logger).catch(() => {});
                }

                return {
                    success: true,
                    data: { user, token: accessToken },
                };
            } catch (error) {
                logger.error("Users: Unhandled error in POST /telegram", {
                    telegramId: body.id,
                    error,
                });
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
        async ({ body, user, set, logger }): Promise<ReturnSchema> => {
            try {
                await prisma.users.update({
                    where: { id: user.id },
                    data: { language: body.language },
                });

                logger.info("Users: Language updated", { userId: user.id, language: body.language });
                return { success: true, data: { language: body.language } };
            } catch (error) {
                logger.error("Users: Error updating language", { userId: user.id, error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            auth: true,
            body: t.Object({ language: t.Union([t.Literal("uz"), t.Literal("ru")]) }),
        },
    );
