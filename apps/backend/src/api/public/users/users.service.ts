import type { TelegramLoginBody, AdminUserItem } from "@jahonbozor/schemas/src/users";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";
import { auditInTransaction } from "@backend/lib/audit";
import { UsersService } from "@backend/api/private/users/users.service";
import Auth from "@backend/api/public/auth/auth.service";
import { sendContactRequest } from "@backend/lib/telegram";
import dayjs from "dayjs";

interface JwtSigner {
	sign(payload: Record<string, unknown>): Promise<string>;
}

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

			const user = result.data!;

			// Generate JWT tokens
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
				return { success: false, error: "Internal Server Error" };
			}

			logger.info("Users: Telegram authentication successful", {
				userId: user.id,
				telegramId: telegramData.id,
			});

			// Send contact request if user has no phone
			const shouldSendContactRequest = !user.phone;
			if (shouldSendContactRequest) {
				sendContactRequest(String(telegramData.id), user.language, logger).catch(() => {});
			}

			return {
				success: true,
				data: {
					user,
					accessToken,
					refreshToken,
					refreshTokenExp: refreshTokenExp.toDate(),
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
