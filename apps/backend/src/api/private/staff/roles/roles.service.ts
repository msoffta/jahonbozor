import { auditInTransaction } from "@backend/lib/audit";
import { prisma } from "@backend/lib/prisma";
import { createRoleSnapshot } from "@backend/lib/snapshots";

import type { Prisma } from "@backend/generated/prisma/client";
import type { ServiceContext } from "@backend/lib/audit";
import type { Logger } from "@jahonbozor/logger";
import type {
    CreateRoleBody,
    RoleDetailResponse,
    RolesListResponse,
    UpdateRoleBody,
} from "@jahonbozor/schemas/src/roles";

interface RolesPagination {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: string;
    searchQuery?: string;
    includeStaffCount?: boolean;
}

export abstract class RolesService {
    static async getAllRoles(params: RolesPagination, logger: Logger): Promise<RolesListResponse> {
        try {
            const { page, limit, sortBy, sortOrder, searchQuery, includeStaffCount } = params;
            const whereClause: Prisma.RoleWhereInput = { deletedAt: null };

            if (searchQuery) {
                whereClause.name = { contains: searchQuery, mode: "insensitive" };
            }

            const [count, roles] = await prisma.$transaction([
                prisma.role.count({ where: whereClause }),
                prisma.role.findMany({
                    skip: (page - 1) * limit,
                    take: limit,
                    where: whereClause,
                    include: includeStaffCount
                        ? { _count: { select: { staffs: true } } }
                        : undefined,
                    orderBy: { [sortBy]: sortOrder },
                }),
            ]);

            return {
                success: true,
                data: { count, roles },
            };
        } catch (error) {
            logger.error("Roles: Error in getAllRoles", {
                searchQuery: params.searchQuery,
                page: params.page,
                limit: params.limit,
                error,
            });
            return { success: false, error };
        }
    }

    static async getRole(
        roleId: number,
        includeStaffCount: boolean | undefined,
        logger: Logger,
    ): Promise<RoleDetailResponse> {
        try {
            const role = await prisma.role.findFirst({
                where: { id: roleId, deletedAt: null },
                include: includeStaffCount ? { _count: { select: { staffs: true } } } : undefined,
            });

            if (!role) {
                logger.warn("Roles: Role not found", { roleId });
                return { success: false, error: "Role not found" };
            }

            return { success: true, data: role };
        } catch (error) {
            logger.error("Roles: Error in getRole", { roleId, error });
            return { success: false, error };
        }
    }

    static async createRole(
        roleData: CreateRoleBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<RoleDetailResponse> {
        try {
            const existingRole = await prisma.role.findFirst({
                where: { name: roleData.name },
            });

            if (existingRole) {
                logger.warn("Roles: Role name already exists", { name: roleData.name });
                return { success: false, error: "Role name already exists" };
            }

            const [newRole] = await prisma.$transaction(async (transaction) => {
                const role = await transaction.role.create({
                    data: {
                        name: roleData.name,
                        permissions: roleData.permissions,
                    },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "role",
                        entityId: role.id,
                        action: "CREATE",
                        newData: createRoleSnapshot(role),
                    },
                );

                return [role];
            });

            logger.info("Roles: Role created", {
                roleId: newRole.id,
                name: roleData.name,
                staffId: context.staffId,
            });
            return { success: true, data: newRole };
        } catch (error) {
            logger.error("Roles: Error in createRole", { name: roleData.name, error });
            return { success: false, error };
        }
    }

    static async updateRole(
        roleId: number,
        roleData: UpdateRoleBody,
        context: ServiceContext,
        logger: Logger,
    ): Promise<RoleDetailResponse> {
        try {
            const existingRole = await prisma.role.findUnique({
                where: { id: roleId },
            });

            if (!existingRole) {
                logger.warn("Roles: Role not found for update", { roleId });
                return { success: false, error: "Role not found" };
            }

            if (roleData.name && roleData.name !== existingRole.name) {
                const duplicateName = await prisma.role.findFirst({
                    where: {
                        name: roleData.name,
                        id: { not: roleId },
                    },
                });

                if (duplicateName) {
                    logger.warn("Roles: Role name already exists", { roleId, name: roleData.name });
                    return { success: false, error: "Role name already exists" };
                }
            }

            const permissionsChanged =
                roleData.permissions !== undefined &&
                JSON.stringify([...roleData.permissions].sort()) !==
                    JSON.stringify([...existingRole.permissions].sort());
            const auditAction = permissionsChanged ? "PERMISSION_CHANGE" : "UPDATE";

            const [updatedRole] = await prisma.$transaction(async (transaction) => {
                const role = await transaction.role.update({
                    where: { id: roleId },
                    data: roleData,
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "role",
                        entityId: roleId,
                        action: auditAction,
                        previousData: createRoleSnapshot(existingRole),
                        newData: createRoleSnapshot(role),
                    },
                );

                return [role];
            });

            logger.info("Roles: Role updated", {
                roleId,
                permissionsChanged,
                staffId: context.staffId,
            });
            return { success: true, data: updatedRole };
        } catch (error) {
            logger.error("Roles: Error in updateRole", { roleId, error });
            return { success: false, error };
        }
    }

    static async deleteRole(
        roleId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<RoleDetailResponse> {
        try {
            const existingRole = await prisma.role.findFirst({
                where: { id: roleId, deletedAt: null },
            });

            if (!existingRole) {
                logger.warn("Roles: Role not found for delete", { roleId });
                return { success: false, error: "Role not found" };
            }

            const staffCount = await prisma.staff.count({
                where: { roleId, deletedAt: null },
            });

            if (staffCount > 0) {
                logger.warn("Roles: Cannot delete role with assigned staff", {
                    roleId,
                    staffCount,
                });
                return {
                    success: false,
                    error: `Cannot delete role with ${staffCount} assigned staff member(s)`,
                };
            }

            const [deletedRole] = await prisma.$transaction(async (transaction) => {
                const role = await transaction.role.update({
                    where: { id: roleId },
                    data: { deletedAt: new Date() },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "role",
                        entityId: roleId,
                        action: "DELETE",
                        previousData: createRoleSnapshot(existingRole),
                    },
                );

                return [role];
            });

            logger.info("Roles: Role deleted", {
                roleId,
                name: existingRole.name,
                staffId: context.staffId,
            });
            return { success: true, data: deletedRole };
        } catch (error) {
            logger.error("Roles: Error in deleteRole", { roleId, error });
            return { success: false, error };
        }
    }

    static async restoreRole(
        roleId: number,
        context: ServiceContext,
        logger: Logger,
    ): Promise<RoleDetailResponse> {
        try {
            const deletedRole = await prisma.role.findFirst({
                where: { id: roleId, deletedAt: { not: null } },
            });

            if (!deletedRole) {
                logger.warn("Roles: Deleted role not found for restore", { roleId });
                return { success: false, error: "Deleted role not found" };
            }

            const [restoredRole] = await prisma.$transaction(async (transaction) => {
                const role = await transaction.role.update({
                    where: { id: roleId },
                    data: { deletedAt: null },
                });

                await auditInTransaction(
                    transaction,
                    { requestId: context.requestId, user: context.user, logger },
                    {
                        entityType: "role",
                        entityId: roleId,
                        action: "RESTORE",
                        previousData: createRoleSnapshot(deletedRole),
                        newData: createRoleSnapshot(role),
                    },
                );

                return [role];
            });

            logger.info("Roles: Role restored", {
                roleId,
                name: restoredRole.name,
                staffId: context.staffId,
            });
            return { success: true, data: restoredRole };
        } catch (error) {
            logger.error("Roles: Error in restoreRole", { roleId, error });
            return { success: false, error };
        }
    }
}
