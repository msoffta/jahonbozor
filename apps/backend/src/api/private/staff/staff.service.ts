import { password } from "bun";

import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { createStaffSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    CreateStaffBody,
    StaffDeleteResponse,
    StaffDetailResponse,
    StaffListResponse,
    StaffPagination,
    UpdateStaffBody,
} from "@jahonbozor/schemas/src/staff";

const staffSelect = {
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
};

export abstract class StaffService {
    static async getAllStaff(
        { page, limit, sortBy, sortOrder, searchQuery, roleId }: StaffPagination,
        logger: Logger,
    ): Promise<StaffListResponse> {
        try {
            const whereClause = {
                deletedAt: null,
                AND: [
                    searchQuery
                        ? {
                              OR: [
                                  { fullname: { contains: searchQuery } },
                                  { username: { contains: searchQuery } },
                              ],
                          }
                        : {},
                    roleId ? { roleId } : {},
                ],
            };

            const [count, staffList] = await prisma.$transaction([
                prisma.staff.count({ where: whereClause }),
                prisma.staff.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    select: staffSelect,
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            return {
                success: true,
                data: { count, staff: staffList },
            };
        } catch (error) {
            logger.error("Staff: Error in getAllStaff", {
                searchQuery,
                roleId,
                page,
                limit,
                error,
            });
            return { success: false, error };
        }
    }

    static async getStaff(staffId: number, logger: Logger): Promise<StaffDetailResponse> {
        try {
            const staffRecord = await prisma.staff.findUnique({
                where: { id: staffId, deletedAt: null },
                select: staffSelect,
            });

            if (!staffRecord) {
                logger.warn("Staff: Staff not found", { staffId });
                return { success: false, error: "Staff not found" };
            }

            return { success: true, data: staffRecord };
        } catch (error) {
            logger.error("Staff: Error in getStaff", { staffId, error });
            return { success: false, error };
        }
    }

    static async createStaff(
        staffData: CreateStaffBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<StaffDetailResponse> {
        try {
            const existingStaff = await prisma.staff.findFirst({
                where: { username: staffData.username },
            });

            if (existingStaff) {
                logger.warn("Staff: Username already exists", { username: staffData.username });
                return { success: false, error: "Username already exists" };
            }

            const passwordHash = await password.hash(staffData.password, {
                algorithm: "argon2id",
            });

            const [newStaff] = await prisma.$transaction(async (transaction) => {
                const staff = await transaction.staff.create({
                    data: {
                        fullname: staffData.fullname,
                        username: staffData.username,
                        passwordHash,
                        telegramId: BigInt(staffData.telegramId),
                        roleId: staffData.roleId,
                    },
                    select: staffSelect,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "staff",
                        entityId: staff.id,
                        action: "CREATE",
                        newData: createStaffSnapshot(staff),
                    },
                );

                return [staff];
            });

            logger.info("Staff: Staff created", {
                staffId: newStaff.id,
                username: staffData.username,
                createdBy: context.staffId,
            });

            return { success: true, data: newStaff };
        } catch (error) {
            logger.error("Staff: Error in createStaff", { username: staffData.username, error });
            return { success: false, error };
        }
    }

    static async updateStaff(
        staffId: number,
        staffData: UpdateStaffBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<StaffDetailResponse> {
        try {
            const existingStaff = await prisma.staff.findUnique({
                where: { id: staffId },
            });

            if (!existingStaff) {
                logger.warn("Staff: Staff not found for update", { staffId });
                return { success: false, error: "Staff not found" };
            }

            if (staffData.username && staffData.username !== existingStaff.username) {
                const duplicateUsername = await prisma.staff.findFirst({
                    where: {
                        username: staffData.username,
                        id: { not: staffId },
                    },
                });

                if (duplicateUsername) {
                    logger.warn("Staff: Username already exists", {
                        staffId,
                        username: staffData.username,
                    });
                    return { success: false, error: "Username already exists" };
                }
            }

            const updateData: Prisma.StaffUncheckedUpdateInput = {};
            const passwordChanged = staffData.password !== undefined;

            if (staffData.fullname !== undefined) {
                updateData.fullname = staffData.fullname;
            }
            if (staffData.username !== undefined) {
                updateData.username = staffData.username;
            }
            if (passwordChanged) {
                updateData.passwordHash = await password.hash(staffData.password!, {
                    algorithm: "argon2id",
                });
            }
            if (staffData.telegramId !== undefined) {
                updateData.telegramId = BigInt(staffData.telegramId);
            }
            if (staffData.roleId !== undefined) {
                updateData.roleId = staffData.roleId;
            }

            const auditAction = passwordChanged ? "PASSWORD_CHANGE" : "UPDATE";

            const [updatedStaff] = await prisma.$transaction(async (transaction) => {
                const staff = await transaction.staff.update({
                    where: { id: staffId },
                    data: updateData,
                    select: staffSelect,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "staff",
                        entityId: staffId,
                        action: auditAction,
                        previousData: createStaffSnapshot(existingStaff),
                        newData: createStaffSnapshot(staff),
                    },
                );

                return [staff];
            });

            logger.info("Staff: Staff updated", {
                staffId,
                passwordChanged,
                updatedBy: context.staffId,
            });

            return { success: true, data: updatedStaff };
        } catch (error) {
            logger.error("Staff: Error in updateStaff", { staffId, error });
            return { success: false, error };
        }
    }

    static async deleteStaff(
        staffId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<StaffDeleteResponse> {
        try {
            const existingStaff = await prisma.staff.findUnique({
                where: { id: staffId },
            });

            if (!existingStaff) {
                logger.warn("Staff: Staff not found for delete", { staffId });
                return { success: false, error: "Staff not found" };
            }

            if (existingStaff.deletedAt) {
                logger.warn("Staff: Staff already deleted", { staffId });
                return { success: false, error: "Staff already deleted" };
            }

            const [deletedStaff] = await prisma.$transaction(async (transaction) => {
                // Revoke all refresh tokens before soft deleting staff
                await transaction.refreshToken.deleteMany({
                    where: { staffId },
                });

                const staff = await transaction.staff.update({
                    where: { id: staffId },
                    data: { deletedAt: new Date() },
                    select: {
                        id: true,
                        fullname: true,
                        username: true,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "staff",
                        entityId: staffId,
                        action: "DELETE",
                        previousData: createStaffSnapshot(existingStaff),
                    },
                );

                return [staff];
            });

            logger.info("Staff: Staff deleted", {
                staffId,
                username: deletedStaff.username,
                deletedBy: context.staffId,
            });

            return { success: true, data: deletedStaff };
        } catch (error) {
            logger.error("Staff: Error in deleteStaff", { staffId, error });
            return { success: false, error };
        }
    }

    static async restoreStaff(
        staffId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<StaffDeleteResponse> {
        try {
            const existingStaff = await prisma.staff.findUnique({
                where: { id: staffId },
            });

            if (!existingStaff) {
                logger.warn("Staff: Staff not found for restore", { staffId });
                return { success: false, error: "Staff not found" };
            }

            if (!existingStaff.deletedAt) {
                logger.warn("Staff: Staff is not deleted", { staffId });
                return { success: false, error: "Staff is not deleted" };
            }

            const [restoredStaff] = await prisma.$transaction(async (transaction) => {
                const staff = await transaction.staff.update({
                    where: { id: staffId },
                    data: { deletedAt: null },
                    select: {
                        id: true,
                        fullname: true,
                        username: true,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "staff",
                        entityId: staffId,
                        action: "RESTORE",
                        previousData: { deletedAt: existingStaff.deletedAt },
                        newData: createStaffSnapshot(existingStaff),
                    },
                );

                return [staff];
            });

            logger.info("Staff: Staff restored", {
                staffId,
                username: restoredStaff.username,
                restoredBy: context.staffId,
            });

            return { success: true, data: restoredStaff };
        } catch (error) {
            logger.error("Staff: Error in restoreStaff", { staffId, error });
            return { success: false, error };
        }
    }
}
