import { TelegramAuthBody } from "@jahonbozor/schemas/src/users";
import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Elysia, t } from "elysia";
import jwt from "@elysiajs/jwt";
import dayjs from "dayjs";
import { requestContext } from "@lib/request-context";
import { Users } from "@api/private/users/users.service";

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
        async ({ body, cookie: { auth }, jwt, set, logger, requestId }): Promise<ReturnSchema> => {
            try {
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                if (!botToken) {
                    logger.error("Users: TELEGRAM_BOT_TOKEN is not configured");
                    set.status = 500;
                    return { success: false, error: "Server configuration error" };
                }

                const isValidHash = Users.validateTelegramHash(body, botToken);
                if (!isValidHash) {
                    logger.warn("Users: Invalid Telegram hash", { telegramId: body.id });
                    set.status = 401;
                    return { success: false, error: "Invalid authentication data" };
                }

                // Check if auth_date is not too old (5 minutes max)
                const authTimestamp = body.auth_date * 1000;
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                if (authTimestamp < fiveMinutesAgo) {
                    logger.warn("Users: Telegram auth data expired", {
                        telegramId: body.id,
                        authDate: body.auth_date,
                    });
                    set.status = 401;
                    return { success: false, error: "Authentication data expired" };
                }

                const result = await Users.createOrUpdateFromTelegram(body, logger, undefined, requestId);

                if (!result.success || !result.data) {
                    set.status = 400;
                    return result;
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
                    telegramId: user.telegramId,
                    type: "user",
                    exp: dayjs().add(15, "minute").unix(),
                });

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
                    telegramId: body.id,
                });

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
            body: TelegramAuthBody,
            cookie: authCookieSchema,
        },
    );
