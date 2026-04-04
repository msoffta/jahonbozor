import { parse, validate } from "@telegram-apps/init-data-node/web";
import { addDays, addMinutes, getUnixTime } from "date-fns";

import { UsersService } from "@backend/api/private/users/users.service";
import { AuthService } from "@backend/api/public/auth/auth.service";
import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { sendContactRequest } from "@backend/lib/telegram";

import type { JwtSigner } from "@backend/api/public/auth/auth.service";
import type { Logger } from "@jahonbozor/logger";
import type { Token } from "@jahonbozor/schemas";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import type {
    AdminUserItem,
    TelegramLoginBody,
    TelegramWebAppAuthBody,
} from "@jahonbozor/schemas/src/users";

interface AuthContext {
    requestId: string;
}

interface AuthResultData {
    user: AdminUserItem;
    accessToken: string;
    refreshToken: string;
    refreshTokenExp: Date;
    shouldSendContactRequest: boolean;
}

export abstract class PublicUsersService {
    static async authenticateWithTelegram(
        body: TelegramLoginBody,
        jwt: JwtSigner,
        context: AuthContext,
        logger: Logger,
    ): Promise<ReturnSchema<AuthResultData>> {
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                logger.error("Users: TELEGRAM_BOT_TOKEN is not configured");
                return { success: false, error: "Server configuration error" };
            }

            // Extract language before hash validation — it's not part of Telegram's signed data
            const { language, ...telegramData } = body;

            const isValidHash = UsersService.validateTelegramHash(telegramData, botToken);
            if (!isValidHash) {
                logger.warn("Users: Invalid Telegram hash", { telegramId: telegramData.id });
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
                return { success: false, error: "Authentication data expired" };
            }

            const result = await UsersService.createOrUpdateFromTelegram(
                telegramData,
                logger,
                undefined,
                context.requestId,
                language,
            );

            if (!result.success) {
                return { success: false, error: result.error };
            }

            const user = result.data;

            // Generate JWT tokens
            const refreshTokenExp = addDays(new Date(), 30);

            const refreshToken = await jwt.sign({
                id: user.id,
                type: "user",
                exp: getUnixTime(refreshTokenExp),
            });

            const accessToken = await jwt.sign({
                id: user.id,
                fullname: user.fullname,
                username: user.username,
                phone: user.phone,
                telegramId: String(user.telegramId),
                type: "user",
                exp: getUnixTime(addMinutes(new Date(), 15)),
            });

            // Save refresh token to database
            const isRefreshTokenSaved = await AuthService.saveRefreshToken(
                { token: refreshToken, exp: refreshTokenExp, userId: user.id },
                logger,
            );

            if (!isRefreshTokenSaved) {
                logger.error("Users: Refresh token not saved", { userId: user.id });
                return { success: false, error: "Internal Server Error" };
            }

            logger.info("Users: Telegram authentication successful", {
                userId: user.id,
                telegramId: telegramData.id,
            });

            // Send contact request if user has no phone
            const shouldSendContactRequest = !user.phone;
            if (shouldSendContactRequest) {
                sendContactRequest(String(telegramData.id), user.language, logger).catch(() => {
                    /* fire-and-forget */
                });
            }

            return {
                success: true,
                data: {
                    user,
                    accessToken,
                    refreshToken,
                    refreshTokenExp: refreshTokenExp,
                    shouldSendContactRequest,
                },
            };
        } catch (error) {
            logger.error("Users: Unhandled error in authenticateWithTelegram", {
                telegramId: body.id,
                error,
            });
            return { success: false, error: "Internal Server Error" };
        }
    }

    static async authenticateWithWebApp(
        body: TelegramWebAppAuthBody,
        jwt: JwtSigner,
        context: AuthContext,
        logger: Logger,
    ): Promise<ReturnSchema<AuthResultData>> {
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                logger.error("Users: TELEGRAM_BOT_TOKEN is not configured");
                return { success: false, error: "Server configuration error" };
            }

            // Validate initData signature (async — uses Web Crypto API)
            try {
                await validate(body.initData, botToken, { expiresIn: 86400 });
            } catch (error) {
                logger.warn("Users: Invalid Mini App initData", { error });
                return { success: false, error: "Invalid authentication data" };
            }

            // Parse initData to extract user info
            const initData = parse(body.initData);
            const tgUser = initData.user as
                | {
                      id: number;
                      first_name: string;
                      last_name?: string;
                      username?: string;
                      photo_url?: string;
                  }
                | undefined;
            if (!tgUser) {
                logger.warn("Users: Mini App initData missing user");
                return { success: false, error: "Invalid authentication data" };
            }

            const authDate = initData.auth_date;

            // Map to TelegramAuthBody format for createOrUpdateFromTelegram
            const telegramData = {
                id: String(tgUser.id),
                first_name: tgUser.first_name,
                last_name: tgUser.last_name ?? undefined,
                username: tgUser.username ?? undefined,
                photo_url: tgUser.photo_url ?? undefined,
                auth_date: authDate.getTime() / 1000,
                hash: initData.hash,
            };

            const result = await UsersService.createOrUpdateFromTelegram(
                telegramData,
                logger,
                undefined,
                context.requestId,
                body.language,
            );

            if (!result.success) {
                return { success: false, error: result.error };
            }

            const user = result.data;

            // Generate JWT tokens (same as authenticateWithTelegram)
            const refreshTokenExp = addDays(new Date(), 30);

            const refreshToken = await jwt.sign({
                id: user.id,
                type: "user",
                exp: getUnixTime(refreshTokenExp),
            });

            const accessToken = await jwt.sign({
                id: user.id,
                fullname: user.fullname,
                username: user.username,
                phone: user.phone,
                telegramId: String(user.telegramId),
                type: "user",
                exp: getUnixTime(addMinutes(new Date(), 15)),
            });

            const isRefreshTokenSaved = await AuthService.saveRefreshToken(
                { token: refreshToken, exp: refreshTokenExp, userId: user.id },
                logger,
            );

            if (!isRefreshTokenSaved) {
                logger.error("Users: Refresh token not saved", { userId: user.id });
                return { success: false, error: "Internal Server Error" };
            }

            logger.info("Users: Mini App authentication successful", {
                userId: user.id,
                telegramId: tgUser.id,
            });

            // Send contact request if user has no phone
            const shouldSendContactRequest = !user.phone;
            if (shouldSendContactRequest) {
                sendContactRequest(String(tgUser.id), user.language, logger).catch(() => {
                    /* fire-and-forget */
                });
            }

            return {
                success: true,
                data: {
                    user,
                    accessToken,
                    refreshToken,
                    refreshTokenExp,
                    shouldSendContactRequest,
                },
            };
        } catch (error) {
            logger.error("Users: Unhandled error in authenticateWithWebApp", { error });
            return { success: false, error: "Internal Server Error" };
        }
    }

    static async updateLanguage(
        userId: number,
        language: "uz" | "ru",
        context: { requestId?: string; user?: Token },
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { id: userId },
                select: { id: true, language: true },
            });

            if (!existingUser) {
                logger.warn("Users: User not found for language update", { userId });
                return { success: false, error: "User not found" };
            }

            await prisma.$transaction(async (transaction) => {
                await transaction.users.update({
                    where: { id: userId },
                    data: { language },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "users",
                        entityId: userId,
                        action: "UPDATE",
                        previousData: { language: existingUser.language },
                        newData: { language },
                    },
                );
            });

            logger.info("Users: Language updated", { userId, language });
            return { success: true, data: { language } };
        } catch (error) {
            logger.error("Users: Error updating language", { userId, error });
            return { success: false, error: "Internal Server Error" };
        }
    }
}
