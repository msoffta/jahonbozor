import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateUserBody,
    TelegramAuthBody,
    UsersPagination,
} from "@jahonbozor/schemas/src/users";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";
import crypto from "crypto";

export abstract class Users {
    static async getAllUsers({
        page,
        limit,
        searchQuery,
        includeOrders,
    }: UsersPagination): Promise<ReturnSchema> {
        try {
            const [count, users] = await prisma.$transaction([
                prisma.users.count(),
                prisma.users.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: {
                        OR: [
                            {
                                fullname: {
                                    contains: searchQuery,
                                },
                            },
                            {
                                username: {
                                    contains: searchQuery,
                                },
                            },
                        ],
                    },
                    include: {
                        orders: includeOrders,
                    },
                }),
            ]);

            return {
                success: true,
                data: {
                    count,
                    users,
                },
            };
        } catch (error) {
            logger.error("Users: Error in getAllUsers", { searchQuery, page, limit, error });
            return { success: false, error };
        }
    }
    static async getUser(userId: number): Promise<ReturnSchema> {
        try {
            const user = await prisma.users.findUnique({
                where: { id: userId },
            });

            if (!user) {
                logger.warn("Users: User not found", { userId });
                return { success: false, error: "User not found" };
            }

            return { success: true, data: user };
        } catch (error) {
            logger.error("Users: Error in getUser", { userId, error });
            return { success: false, error };
        }
    }
    static async createUser(userData: CreateUserBody): Promise<ReturnSchema> {
        try {
            const newUser = await prisma.users.create({
                data: userData,
            });
            logger.info("Users: User created", { userId: newUser.id });
            return {
                success: true,
                data: newUser,
            };
        } catch (error) {
            logger.error("Users: Error in createUser", { error });
            return { success: false, error };
        }
    }

    static validateTelegramHash(data: TelegramAuthBody, botToken: string): boolean {
        const { hash, ...dataWithoutHash } = data;

        const dataCheckString = Object.entries(dataWithoutHash)
            .filter(([_, value]) => value !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        const secretKey = crypto
            .createHash("sha256")
            .update(botToken)
            .digest();

        const computedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        return computedHash === hash;
    }

    static async createOrUpdateFromTelegram(
        telegramData: TelegramAuthBody,
        phone?: string,
    ): Promise<ReturnSchema> {
        try {
            const fullname = telegramData.last_name
                ? `${telegramData.first_name} ${telegramData.last_name}`
                : telegramData.first_name;

            // Check if user already linked to this Telegram account
            const existingUserByTelegram = await prisma.users.findUnique({
                where: { telegramId: telegramData.id },
            });

            if (existingUserByTelegram) {
                const updatedUser = await prisma.users.update({
                    where: { id: existingUserByTelegram.id },
                    data: {
                        fullname,
                        username: telegramData.username || existingUserByTelegram.username,
                        photo: telegramData.photo_url,
                    },
                });
                logger.info("Users: Updated user from Telegram", { userId: updatedUser.id });
                return { success: true, data: updatedUser };
            }

            // Phone provided - link Telegram to existing user created by admin
            if (phone) {
                const existingUserByPhone = await prisma.users.findUnique({
                    where: { phone },
                });

                if (existingUserByPhone) {
                    const linkedUser = await prisma.users.update({
                        where: { id: existingUserByPhone.id },
                        data: {
                            telegramId: telegramData.id,
                            fullname,
                            username: telegramData.username || existingUserByPhone.username,
                            photo: telegramData.photo_url,
                        },
                    });
                    logger.info("Users: Linked Telegram to existing user", {
                        userId: linkedUser.id,
                        telegramId: telegramData.id,
                    });
                    return { success: true, data: linkedUser };
                }
            }

            // New user registration via Telegram
            const newUser = await prisma.users.create({
                data: {
                    telegramId: telegramData.id,
                    fullname,
                    username: telegramData.username || telegramData.id,
                    phone: phone || "",
                    photo: telegramData.photo_url,
                },
            });
            logger.info("Users: Created new user from Telegram", {
                userId: newUser.id,
                telegramId: telegramData.id,
            });
            return { success: true, data: newUser };
        } catch (error) {
            logger.error("Users: Error in createOrUpdateFromTelegram", { telegramId: telegramData.id, error });
            return { success: false, error };
        }
    }

    static async deleteUser(userId: number): Promise<ReturnSchema> {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { id: userId },
            });

            if (!existingUser) {
                logger.warn("Users: User not found for delete", { userId });
                return { success: false, error: "User not found" };
            }

            const deletedUser = await prisma.users.delete({
                where: { id: userId },
            });

            logger.info("Users: User deleted", { userId });
            return { success: true, data: deletedUser };
        } catch (error) {
            logger.error("Users: Error in deleteUser", { userId, error });
            return { success: false, error };
        }
    }
}
