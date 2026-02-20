import type { StaffListResponse, StaffDetailResponse, StaffDeleteResponse } from "@jahonbozor/schemas/src/staff";
import { Permission, hasAnyPermission } from "@jahonbozor/schemas";
import {
    CreateStaffBody,
    UpdateStaffBody,
    StaffPagination,
} from "@jahonbozor/schemas/src/staff";
import { authMiddleware } from "@backend/lib/middleware";
import { Elysia, t } from "elysia";
import { StaffService } from "./staff.service";
import { roles } from "./roles/roles.index";

const staffIdParams = t.Object({
    id: t.Numeric(),
});

export const staff = new Elysia({ prefix: "/staff" })
    .use(authMiddleware)
    .get(
        "/",
        async ({ query, logger }): Promise<StaffListResponse> => {
            try {
                return await StaffService.getAllStaff(query, logger);
            } catch (error) {
                logger.error("Staff: Unhandled error in GET /staff", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.STAFF_LIST],
            query: StaffPagination,
        },
    )
    .get(
        "/:id",
        async ({ params, user, permissions, set, logger }): Promise<StaffDetailResponse> => {
            try {
                const targetStaffId = params.id;
                const requestingStaffId = user.id;

                const isOwnProfile = targetStaffId === requestingStaffId;
                const hasReadAll = hasAnyPermission(permissions, [Permission.STAFF_READ_ALL]);

                if (!isOwnProfile && !hasReadAll) {
                    logger.warn("Staff: Insufficient permissions to read other staff", {
                        requestingStaffId,
                        targetStaffId,
                    });
                    set.status = 403;
                    return { success: false, error: "Forbidden" };
                }

                const result = await StaffService.getStaff(targetStaffId, logger);

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Staff: Unhandled error in GET /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.STAFF_READ_OWN],
            params: staffIdParams,
        },
    )
    .post(
        "/",
        async ({ body, user, set, logger, requestId }): Promise<StaffDetailResponse> => {
            try {
                const result = await StaffService.createStaff(
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Staff: Unhandled error in POST /staff", { error });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.STAFF_CREATE],
            body: CreateStaffBody,
        },
    )
    .patch(
        "/:id",
        async ({ params, body, user, permissions, set, logger, requestId }): Promise<StaffDetailResponse> => {
            try {
                const targetStaffId = params.id;
                const requestingStaffId = user.id;

                const isOwnProfile = targetStaffId === requestingStaffId;
                const hasUpdateAll = hasAnyPermission(permissions, [Permission.STAFF_UPDATE_ALL]);

                if (!isOwnProfile && !hasUpdateAll) {
                    logger.warn("Staff: Insufficient permissions to update other staff", {
                        requestingStaffId,
                        targetStaffId,
                    });
                    set.status = 403;
                    return { success: false, error: "Forbidden" };
                }

                if (isOwnProfile && !hasUpdateAll && body.roleId !== undefined) {
                    logger.warn("Staff: Attempted to change own role without UPDATE_ALL", {
                        requestingStaffId,
                    });
                    set.status = 403;
                    return { success: false, error: "Cannot change own role" };
                }

                const result = await StaffService.updateStaff(
                    targetStaffId,
                    body,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 400;
                }

                return result;
            } catch (error) {
                logger.error("Staff: Unhandled error in PATCH /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.STAFF_UPDATE_OWN],
            params: staffIdParams,
            body: UpdateStaffBody,
        },
    )
    .delete(
        "/:id",
        async ({ params, user, set, logger, requestId }): Promise<StaffDeleteResponse> => {
            try {
                const result = await StaffService.deleteStaff(
                    params.id,
                    { staffId: user.id, user, requestId },
                    logger,
                );

                if (!result.success) {
                    set.status = 404;
                }

                return result;
            } catch (error) {
                logger.error("Staff: Unhandled error in DELETE /:id", {
                    id: params.id,
                    error,
                });
                return { success: false, error };
            }
        },
        {
            permissions: [Permission.STAFF_DELETE],
            params: staffIdParams,
        },
    )
    .use(roles);
