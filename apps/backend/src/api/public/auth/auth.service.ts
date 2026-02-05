import { prettifyError, SignInBody } from "@jahonbozor/schemas";
import { AuthStaff } from "@jahonbozor/schemas/src/staff/staff.model";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";

import { password } from "bun";

export default abstract class Auth {
    static async checkIfStaffExists({
        username,
        password: staffPassword,
    }: SignInBody) {
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

            const checkPassword = await password.verify(
                staffPassword,
                staffQuery.passwordHash,
            );

            if (!checkPassword) {
                logger.warn("Auth: Password mismatch", { username });
                return null;
            }

            const {
                data: staff,
                success,
                error,
            } = AuthStaff.safeParse(staffQuery);

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
            throw new Error("Auth: Failed to login user");
        }
    }
    static async saveRefreshToken({
        token,
        exp,
        staffId,
    }: {
        token: string;
        exp: Date;
        staffId: number;
    }) {
        try {
            const responseToken = await prisma.refreshToken.create({
                data: {
                    token,
                    expiredAt: exp,
                    staffId,
                },
            });

            logger.info("Auth: Refresh token saved", { staffId });
            return !!responseToken;
        } catch (error) {
            logger.error("Auth: Error in saveRefreshToken", { staffId, error });
            return null;
        }
    }

    static async validateRefreshToken(token: string) {
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

    static async revokeRefreshToken(token: string) {
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

    static async getStaffById(staffId: number) {
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

            return staffRecord;
        } catch (error) {
            logger.error("Auth: Error in getStaffById", { staffId, error });
            return null;
        }
    }

    static async getUserById(userId: number) {
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
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!userRecord) {
                logger.warn("Auth: User not found by id", { userId });
                return null;
            }

            return userRecord;
        } catch (error) {
            logger.error("Auth: Error in getUserById", { userId, error });
            return null;
        }
    }
}
