import type { AdminUsersListResponse, AdminUserDetailResponse } from "@jahonbozor/schemas/src/users";
import {
    CreateUserBody,
    UpdateUserBody,
    TelegramAuthBody,
    UsersPagination,
} from "@jahonbozor/schemas/src/users";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";
import { auditInTransaction } from "@backend/lib/audit";
import type { UsersModel } from "@backend/generated/prisma/models/Users";
import crypto from "crypto";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

function createUserSnapshot(user: UsersModel) {
    return {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        phone: user.phone,
        photo: user.photo,
        telegramId: user.telegramId,
    };
}

export abstract class Users {
    static async getAllUsers(
        { page, limit, searchQuery, includeOrders, includeDeleted }: UsersPagination,
        logger: Logger,
    ): Promise<AdminUsersListResponse> {
        try {
            const whereClause: Record<string, unknown> = {};

            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            if (searchQuery) {
                whereClause.OR = [
                    { fullname: { contains: searchQuery } },
                    { username: { contains: searchQuery } },
                    { phone: { contains: searchQuery } },
                ];
            }

            const [count, users] = await prisma.$transaction([
                prisma.users.count({ where: whereClause }),
                prisma.users.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: {
                        orders: includeOrders,
                    },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            return {
                success: true,
                data: { count, users },
            };
        } catch (error) {
            logger.error("Users: Error in getAllUsers", { searchQuery, page, limit, error });
            return { success: false, error };
        }
    }

    static async getUser(userId: number, logger: Logger): Promise<AdminUserDetailResponse> {
        try {
            const user = await prisma.users.findUnique({
                where: { id: userId },
                include: { orders: true },
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

    static async createUser(
        userData: CreateUserBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<AdminUserDetailResponse> {
        try {
            const [newUser] = await prisma.$transaction(async (transaction) => {
                const user = await transaction.users.create({
                    data: userData,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "users",
                        entityId: user.id,
                        action: "CREATE",
                        newData: createUserSnapshot(user),
                    },
                );

                return [user];
            });

            logger.info("Users: User created", { userId: newUser.id, staffId: context.staffId });
            return { success: true, data: newUser };
        } catch (error) {
            logger.error("Users: Error in createUser", { error });
            return { success: false, error };
        }
    }

    static async updateUser(
        userId: number,
        userData: UpdateUserBody,
        context: AuditContext,
        logger: Logger,
    ): Promise<AdminUserDetailResponse> {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { id: userId },
            });

            if (!existingUser) {
                logger.warn("Users: User not found for update", { userId });
                return { success: false, error: "User not found" };
            }

            if (existingUser.deletedAt) {
                logger.warn("Users: Cannot update deleted user", { userId });
                return { success: false, error: "Cannot update deleted user" };
            }

            const [updatedUser] = await prisma.$transaction(async (transaction) => {
                const user = await transaction.users.update({
                    where: { id: userId },
                    data: userData,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "users",
                        entityId: userId,
                        action: "UPDATE",
                        previousData: createUserSnapshot(existingUser),
                        newData: createUserSnapshot(user),
                    },
                );

                return [user];
            });

            logger.info("Users: User updated", { userId, staffId: context.staffId });
            return { success: true, data: updatedUser };
        } catch (error) {
            logger.error("Users: Error in updateUser", { userId, error });
            return { success: false, error };
        }
    }

    static async deleteUser(
        userId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<AdminUserDetailResponse> {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { id: userId },
            });

            if (!existingUser) {
                logger.warn("Users: User not found for delete", { userId });
                return { success: false, error: "User not found" };
            }

            if (existingUser.deletedAt) {
                logger.warn("Users: User already deleted", { userId });
                return { success: false, error: "User already deleted" };
            }

            const [deletedUser] = await prisma.$transaction(async (transaction) => {
                const user = await transaction.users.update({
                    where: { id: userId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "users",
                        entityId: userId,
                        action: "DELETE",
                        previousData: createUserSnapshot(existingUser),
                    },
                );

                return [user];
            });

            logger.info("Users: User deleted", { userId, staffId: context.staffId });
            return { success: true, data: deletedUser };
        } catch (error) {
            logger.error("Users: Error in deleteUser", { userId, error });
            return { success: false, error };
        }
    }

    static async restoreUser(
        userId: number,
        context: AuditContext,
        logger: Logger,
    ): Promise<AdminUserDetailResponse> {
        try {
            const existingUser = await prisma.users.findUnique({
                where: { id: userId },
            });

            if (!existingUser) {
                logger.warn("Users: User not found for restore", { userId });
                return { success: false, error: "User not found" };
            }

            if (!existingUser.deletedAt) {
                logger.warn("Users: User is not deleted", { userId });
                return { success: false, error: "User is not deleted" };
            }

            const [restoredUser] = await prisma.$transaction(async (transaction) => {
                const user = await transaction.users.update({
                    where: { id: userId },
                    data: { deletedAt: null },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "users",
                        entityId: userId,
                        action: "RESTORE",
                        previousData: { deletedAt: existingUser.deletedAt },
                        newData: createUserSnapshot(user),
                    },
                );

                return [user];
            });

            logger.info("Users: User restored", { userId, staffId: context.staffId });
            return { success: true, data: restoredUser };
        } catch (error) {
            logger.error("Users: Error in restoreUser", { userId, error });
            return { success: false, error };
        }
    }

    // Telegram hash validation uses HMAC-SHA256 per official Telegram docs
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

    // Public method for Telegram authentication вЂ” creates or updates user without staff context
    static async createOrUpdateFromTelegram(
        telegramData: TelegramAuthBody,
        logger: Logger,
        phone?: string,
        requestId?: string,
    ): Promise<AdminUserDetailResponse> {
        try {
            const fullname = telegramData.last_name
                ? `${telegramData.first_name} ${telegramData.last_name}`
                : telegramData.first_name;

            const existingUserByTelegram = await prisma.users.findUnique({
                where: { telegramId: telegramData.id },
            });

            if (existingUserByTelegram) {
                const [updatedUser] = await prisma.$transaction(async (transaction) => {
                    const previousSnapshot = createUserSnapshot(existingUserByTelegram);

                    const user = await transaction.users.update({
                        where: { id: existingUserByTelegram.id },
                        data: {
                            fullname,
                            username: telegramData.username || existingUserByTelegram.username,
                            photo: telegramData.photo_url,
                            deletedAt: null, // Restore if was deleted
                        },
                    });

                    await auditInTransaction(
                        transaction,
                        { requestId, logger },
                        {
                            entityType: "users",
                            entityId: user.id,
                            action: "UPDATE",
                            previousData: previousSnapshot,
                            newData: createUserSnapshot(user),
                        },
                    );

                    return [user];
                });

                logger.info("Users: Updated user from Telegram", { userId: updatedUser.id });
                return { success: true, data: updatedUser };
            }

            if (phone) {
                const existingUserByPhone = await prisma.users.findUnique({
                    where: { phone },
                });

                if (existingUserByPhone) {
                    const [linkedUser] = await prisma.$transaction(async (transaction) => {
                        const previousSnapshot = createUserSnapshot(existingUserByPhone);

                        const user = await transaction.users.update({
                            where: { id: existingUserByPhone.id },
                            data: {
                                telegramId: telegramData.id,
                                fullname,
                                username: telegramData.username || existingUserByPhone.username,
                                photo: telegramData.photo_url,
                                deletedAt: null, // Restore if was deleted
                            },
                        });

                        await auditInTransaction(
                            transaction,
                            { requestId, logger },
                            {
                                entityType: "users",
                                entityId: user.id,
                                action: "UPDATE",
                                previousData: previousSnapshot,
                                newData: createUserSnapshot(user),
                            },
                        );

                        return [user];
                    });

                    logger.info("Users: Linked Telegram to existing user", {
                        userId: linkedUser.id,
                        telegramId: telegramData.id,
                    });
                    return { success: true, data: linkedUser };
                }
            }

            const [newUser] = await prisma.$transaction(async (transaction) => {
                const user = await transaction.users.create({
                    data: {
                        telegramId: telegramData.id,
                        fullname,
                        username: telegramData.username || telegramData.id,
                        phone: phone || null,
                        photo: telegramData.photo_url,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId, logger },
                    {
                        entityType: "users",
                        entityId: user.id,
                        action: "CREATE",
                        newData: createUserSnapshot(user),
                    },
                );

                return [user];
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
}
