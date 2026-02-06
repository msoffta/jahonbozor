import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateStaffBody,
    UpdateStaffBody,
    StaffPagination,
} from "@jahonbozor/schemas/src/staff";
import type { Token } from "@jahonbozor/schemas";
import type { Logger } from "@jahonbozor/logger";
import { prisma } from "@lib/prisma";
import { auditInTransaction } from "@lib/audit";
import { password } from "bun";

interface AuditContext {
    staffId: number;
    user: Token;
    requestId?: string;
}

function createStaffSnapshot(staff: {
    fullname: string;
    username: string;
    roleId: number;
    telegramId?: bigint | null;
}) {
    return {
        fullname: staff.fullname,
        username: staff.username,
        roleId: staff.roleId,
        telegramId: staff.telegramId?.toString() ?? null,
    };
}

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
        { page, limit, searchQuery, roleId }: StaffPagination,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const whereClause = {
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
                }),
            ]);

            return {
                success: true,
                data: { count, staff: staffList },
            };
        } catch (error) {
            logger.error("Staff: Error in getAllStaff", { searchQuery, roleId, page, limit, error });
            return { success: false, error };
        }
    }

    static async getStaff(staffId: number, logger: Logger): Promise<ReturnSchema> {
        try {
            const staffRecord = await prisma.staff.findUnique({
                where: { id: staffId },
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
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
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
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
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
                    logger.warn("Staff: Username already exists", { staffId, username: staffData.username });
                    return { success: false, error: "Username already exists" };
                }
            }

            const updateData: Record<string, unknown> = {};
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
        context: AuditContext,
        logger: Logger,
    ): Promise<ReturnSchema> {
        try {
            const existingStaff = await prisma.staff.findUnique({
                where: { id: staffId },
            });

            if (!existingStaff) {
                logger.warn("Staff: Staff not found for delete", { staffId });
                return { success: false, error: "Staff not found" };
            }

            const [deletedStaff] = await prisma.$transaction(async (transaction) => {
                // Revoke all refresh tokens before deleting staff
                await transaction.refreshToken.deleteMany({
                    where: { staffId },
                });

                const staff = await transaction.staff.delete({
                    where: { id: staffId },
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
}
