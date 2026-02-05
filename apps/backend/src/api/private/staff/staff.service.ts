import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import {
    CreateStaffBody,
    UpdateStaffBody,
    StaffPagination,
} from "@jahonbozor/schemas/src/staff";
import logger from "@lib/logger";
import { prisma } from "@lib/prisma";
import { password } from "bun";

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
    static async getAllStaff({
        page,
        limit,
        searchQuery,
        roleId,
    }: StaffPagination): Promise<ReturnSchema> {
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

    static async getStaff(staffId: number): Promise<ReturnSchema> {
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

    static async createStaff(staffData: CreateStaffBody): Promise<ReturnSchema> {
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

            const newStaff = await prisma.staff.create({
                data: {
                    fullname: staffData.fullname,
                    username: staffData.username,
                    passwordHash,
                    telegramId: BigInt(staffData.telegramId),
                    roleId: staffData.roleId,
                },
                select: staffSelect,
            });

            logger.info("Staff: Staff created", {
                staffId: newStaff.id,
                username: staffData.username,
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

            if (staffData.fullname !== undefined) {
                updateData.fullname = staffData.fullname;
            }
            if (staffData.username !== undefined) {
                updateData.username = staffData.username;
            }
            if (staffData.password !== undefined) {
                updateData.passwordHash = await password.hash(staffData.password, {
                    algorithm: "argon2id",
                });
            }
            if (staffData.telegramId !== undefined) {
                updateData.telegramId = BigInt(staffData.telegramId);
            }
            if (staffData.roleId !== undefined) {
                updateData.roleId = staffData.roleId;
            }

            const updatedStaff = await prisma.staff.update({
                where: { id: staffId },
                data: updateData,
                select: staffSelect,
            });

            logger.info("Staff: Staff updated", { staffId });

            return { success: true, data: updatedStaff };
        } catch (error) {
            logger.error("Staff: Error in updateStaff", { staffId, error });
            return { success: false, error };
        }
    }

    static async deleteStaff(staffId: number): Promise<ReturnSchema> {
        try {
            const existingStaff = await prisma.staff.findUnique({
                where: { id: staffId },
            });

            if (!existingStaff) {
                logger.warn("Staff: Staff not found for delete", { staffId });
                return { success: false, error: "Staff not found" };
            }

            await prisma.refreshToken.deleteMany({
                where: { staffId },
            });

            const deletedStaff = await prisma.staff.delete({
                where: { id: staffId },
                select: {
                    id: true,
                    fullname: true,
                    username: true,
                },
            });

            logger.info("Staff: Staff deleted", {
                staffId,
                username: deletedStaff.username,
            });

            return { success: true, data: deletedStaff };
        } catch (error) {
            logger.error("Staff: Error in deleteStaff", { staffId, error });
            return { success: false, error };
        }
    }
}
