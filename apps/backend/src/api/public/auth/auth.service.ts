import { password } from "bun";
import { addDays, addMinutes, getUnixTime } from "date-fns";

import { prettifyError } from "@jahonbozor/schemas";
import { AuthStaff } from "@jahonbozor/schemas/src/staff/staff.model";

import { prisma } from "@backend/lib/prisma";

import type { Logger } from "@jahonbozor/logger";
import type { SignInBody } from "@jahonbozor/schemas";
import type { ReturnSchema } from "@jahonbozor/schemas/src/base.model";

export interface JwtSigner {
    sign(payload: Record<string, unknown>): Promise<string>;
}

interface LoginResult {
    staff: { id: number; fullname: string; username: string; roleId: number; type: string };
    accessToken: string;
    refreshToken: string;
    refreshTokenExp: Date;
}

interface RefreshResult {
    accessToken: string;
    refreshToken: string;
    refreshTokenExp: Date;
    entityId: number;
    entityType: "staff" | "user";
}

interface LogoutResult {
    entityId?: number;
    entityType?: "staff" | "user";
}

export abstract class AuthService {
    static async checkIfStaffExists(
        { username, password: staffPassword }: SignInBody,
        logger: Logger,
    ): Promise<{
        id: number;
        fullname: string;
        username: string;
        roleId: number;
        type: string;
    } | null> {
        try {
            const staffQuery = await prisma.staff.findFirst({
                where: {
                    username,
                },
                select: {
                    id: true,
                    fullname: true,
                    username: true,
                    passwordHash: true,
                    roleId: true,
                },
            });

            if (!staffQuery) {
                logger.warn("Auth: Staff not found", { username });
                return null;
            }

            const checkPassword = await password.verify(staffPassword, staffQuery.passwordHash);

            if (!checkPassword) {
                logger.warn("Auth: Password mismatch", { username });
                return null;
            }

            const { data: staff, success, error } = AuthStaff.safeParse(staffQuery);

            if (!success) {
                logger.warn("Auth: Staff data is not satisfying schema", {
                    err: prettifyError(error),
                });

                return null;
            }

            logger.info("Auth: Staff login successful", { staffId: staff.id, username });
            return { ...staff, type: "staff" };
        } catch (error) {
            logger.error("Auth: Error in checkIfStaffExists", { username, error });
            return null;
        }
    }

    static async saveRefreshToken(
        {
            token,
            exp,
            staffId,
            userId,
        }: { token: string; exp: Date; staffId?: number; userId?: number },
        logger: Logger,
    ): Promise<boolean | null> {
        try {
            const responseToken = await prisma.refreshToken.create({
                data: {
                    token,
                    expiredAt: exp,
                    ...(staffId ? { staffId } : {}),
                    ...(userId ? { userId } : {}),
                },
            });

            logger.info("Auth: Refresh token saved", { staffId, userId });
            return !!responseToken;
        } catch (error) {
            logger.error("Auth: Error in saveRefreshToken", { staffId, userId, error });
            return null;
        }
    }

    static async validateRefreshToken(
        token: string,
        logger: Logger,
    ): Promise<{
        id: number;
        staffId: number | null;
        userId: number | null;
        revoked: boolean;
        expiredAt: Date;
    } | null> {
        try {
            const tokenRecord = await prisma.refreshToken.findUnique({
                where: { token },
                select: {
                    id: true,
                    staffId: true,
                    userId: true,
                    revoked: true,
                    expiredAt: true,
                },
            });

            if (!tokenRecord) {
                logger.warn("Auth: Refresh token not found");
                return null;
            }

            if (tokenRecord.revoked) {
                logger.warn("Auth: Refresh token is revoked", { tokenId: tokenRecord.id });
                return null;
            }

            if (tokenRecord.expiredAt < new Date()) {
                logger.warn("Auth: Refresh token expired", { tokenId: tokenRecord.id });
                return null;
            }

            return tokenRecord;
        } catch (error) {
            logger.error("Auth: Error in validateRefreshToken", { error });
            return null;
        }
    }

    static async revokeRefreshToken(token: string, logger: Logger): Promise<void> {
        try {
            await prisma.refreshToken.update({
                where: { token },
                data: { revoked: true },
            });
            logger.info("Auth: Refresh token revoked");
        } catch (error) {
            logger.error("Auth: Error in revokeRefreshToken", { error });
        }
    }

    static async getStaffById(staffId: number, logger: Logger) {
        try {
            const staffRecord = await prisma.staff.findUnique({
                where: { id: staffId },
                select: {
                    id: true,
                    fullname: true,
                    username: true,
                    telegramId: true,
                    roleId: true,
                    role: {
                        select: {
                            id: true,
                            name: true,
                            permissions: true,
                        },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!staffRecord) {
                logger.warn("Auth: Staff not found by id", { staffId });
                return null;
            }

            return {
                ...staffRecord,
                telegramId: staffRecord.telegramId != null ? String(staffRecord.telegramId) : null,
            };
        } catch (error) {
            logger.error("Auth: Error in getStaffById", { staffId, error });
            return null;
        }
    }

    static async getUserById(userId: number, logger: Logger) {
        try {
            const userRecord = await prisma.users.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    fullname: true,
                    username: true,
                    phone: true,
                    telegramId: true,
                    photo: true,
                    language: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!userRecord) {
                logger.warn("Auth: User not found by id", { userId });
                return null;
            }

            return {
                ...userRecord,
                telegramId: userRecord.telegramId != null ? String(userRecord.telegramId) : null,
            };
        } catch (error) {
            logger.error("Auth: Error in getUserById", { userId, error });
            return null;
        }
    }

    static async login(
        credentials: SignInBody,
        jwt: JwtSigner,
        logger: Logger,
    ): Promise<ReturnSchema<LoginResult>> {
        const staff = await AuthService.checkIfStaffExists(credentials, logger);
        if (!staff) {
            return { success: false, error: "Unauthorized" };
        }

        const refreshTokenExp = addDays(new Date(), 30);

        const refreshToken = await jwt.sign({
            id: staff.id,
            type: staff.type,
            exp: getUnixTime(refreshTokenExp),
        });

        const accessToken = await jwt.sign({
            id: staff.id,
            fullname: staff.fullname,
            username: staff.username,
            roleId: staff.roleId,
            type: staff.type,
            exp: getUnixTime(addMinutes(new Date(), 15)),
        });

        const isRefreshTokenSaved = await AuthService.saveRefreshToken(
            { token: refreshToken, exp: refreshTokenExp, staffId: staff.id },
            logger,
        );

        if (!isRefreshTokenSaved) {
            logger.error("Auth: Refresh token not saved", { staffId: staff.id });
            return { success: false, error: "Internal Server Error" };
        }

        logger.info("Auth: Staff logged in", { staffId: staff.id, username: credentials.username });
        return {
            success: true,
            data: { staff, accessToken, refreshToken, refreshTokenExp },
        };
    }

    static async refresh(
        refreshTokenValue: string,
        jwt: JwtSigner,
        logger: Logger,
    ): Promise<ReturnSchema<RefreshResult>> {
        const tokenRecord = await AuthService.validateRefreshToken(refreshTokenValue, logger);
        if (!tokenRecord || (!tokenRecord.staffId && !tokenRecord.userId)) {
            return { success: false, error: "Unauthorized" };
        }

        await AuthService.revokeRefreshToken(refreshTokenValue, logger);

        const newRefreshTokenExp = addDays(new Date(), 30);

        if (tokenRecord.staffId) {
            const staffData = await AuthService.getStaffById(tokenRecord.staffId, logger);
            if (!staffData) {
                return { success: false, error: "Unauthorized" };
            }

            const newRefreshToken = await jwt.sign({
                id: staffData.id,
                type: "staff",
                exp: getUnixTime(newRefreshTokenExp),
            });

            const newAccessToken = await jwt.sign({
                id: staffData.id,
                fullname: staffData.fullname,
                username: staffData.username,
                roleId: staffData.roleId,
                type: "staff",
                exp: getUnixTime(addMinutes(new Date(), 15)),
            });

            const isRefreshTokenSaved = await AuthService.saveRefreshToken(
                { token: newRefreshToken, exp: newRefreshTokenExp, staffId: staffData.id },
                logger,
            );

            if (!isRefreshTokenSaved) {
                logger.error("Auth: Failed to save new refresh token", { staffId: staffData.id });
                return { success: false, error: "Internal Server Error" };
            }

            logger.info("Auth: Token refreshed", { staffId: staffData.id });
            return {
                success: true,
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    refreshTokenExp: newRefreshTokenExp,
                    entityId: staffData.id,
                    entityType: "staff",
                },
            };
        }

        const userData = await AuthService.getUserById(tokenRecord.userId!, logger);
        if (!userData) {
            return { success: false, error: "Unauthorized" };
        }

        const newRefreshToken = await jwt.sign({
            id: userData.id,
            type: "user",
            exp: getUnixTime(newRefreshTokenExp),
        });

        const newAccessToken = await jwt.sign({
            id: userData.id,
            fullname: userData.fullname,
            username: userData.username,
            phone: userData.phone,
            telegramId: String(userData.telegramId),
            type: "user",
            exp: getUnixTime(addMinutes(new Date(), 15)),
        });

        const isRefreshTokenSaved = await AuthService.saveRefreshToken(
            { token: newRefreshToken, exp: newRefreshTokenExp, userId: userData.id },
            logger,
        );

        if (!isRefreshTokenSaved) {
            logger.error("Auth: Failed to save new refresh token", { userId: userData.id });
            return { success: false, error: "Internal Server Error" };
        }

        logger.info("Auth: Token refreshed", { userId: userData.id });
        return {
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                refreshTokenExp: newRefreshTokenExp,
                entityId: userData.id,
                entityType: "user",
            },
        };
    }

    static async logout(
        refreshTokenValue: string,
        logger: Logger,
    ): Promise<ReturnSchema<LogoutResult>> {
        const tokenRecord = await AuthService.validateRefreshToken(refreshTokenValue, logger);
        await AuthService.revokeRefreshToken(refreshTokenValue, logger);

        if (tokenRecord?.staffId) {
            logger.info("Auth: Staff logged out", { staffId: tokenRecord.staffId });
            return { success: true, data: { entityId: tokenRecord.staffId, entityType: "staff" } };
        }

        if (tokenRecord?.userId) {
            logger.info("Auth: User logged out", { userId: tokenRecord.userId });
            return { success: true, data: { entityId: tokenRecord.userId, entityType: "user" } };
        }

        logger.info("Auth: Token revoked (no valid session)");
        return { success: true, data: {} };
    }
}
