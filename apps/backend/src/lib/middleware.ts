import bearer from "@elysiajs/bearer";
import jwt from "@elysiajs/jwt";
import {
    prettifyError,
    Token,
    Permission,
    hasPermission,
} from "@jahonbozor/schemas";
import { createChildLogger } from "@jahonbozor/logger";
import { prisma } from "@backend/lib/prisma";
import { Elysia } from "elysia";
import baseLogger from "./logger";
import { requestContext } from "./request-context";

if (!process.env.JWT_SECRET) {
    baseLogger.error("Auth: JWT_SECRET is not configured");
    process.exit(1);
}

export const authMiddleware = new Elysia({
    name: "authMiddleware",
})
    .use(requestContext)
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET,
        }),
    )
    .use(bearer())
    .macro({
        auth: {
            resolve: async ({ jwt, bearer, status, set }) => {
                const requestId = set.headers["x-request-id"] as string | undefined;
                const logger = requestId
                    ? createChildLogger(baseLogger, { requestId })
                    : baseLogger;

                if (!bearer) {
                    logger.debug("Auth: Token not found");
                    return status(401, "Unauthorized");
                }

                const rawPayload = await jwt.verify(bearer);
                if (!rawPayload) {
                    logger.warn("Auth: Invalid Signature or Expired");
                    return status(401, "Unauthorized");
                }

                const payload = Token.safeParse(rawPayload);
                if (!payload.success) {
                    logger.error("Auth: Token Structure mismatch", {
                        err: prettifyError(payload.error),
                    });
                    return status(401, "Unauthorized");
                }

                const user = payload.data;
                const type = user.type;

                const queryConfig = {
                    where: { id: user.id },
                    select: { id: true },
                };

                const resultQuery =
                    type === "staff"
                        ? await prisma.staff.findUnique(queryConfig)
                        : await prisma.users.findUnique(queryConfig);

                if (!resultQuery?.id) {
                    logger.warn("Auth: User or Staff not found in database", {
                        userId: user.id,
                        type,
                    });
                    return status(401, "Unauthorized");
                }

                return {
                    user,
                    type,
                };
            },
        },

        permissions: (requiredPermissions: Permission[]) => ({
            resolve: async ({ jwt, bearer, status, set }) => {
                const requestId = set.headers["x-request-id"] as string | undefined;
                const logger = requestId
                    ? createChildLogger(baseLogger, { requestId })
                    : baseLogger;

                if (!bearer) {
                    logger.debug("Auth: Token not found");
                    return status(401, "Unauthorized");
                }

                const rawPayload = await jwt.verify(bearer);
                if (!rawPayload) {
                    logger.warn("Auth: Invalid Signature or Expired");
                    return status(401, "Unauthorized");
                }

                const payload = Token.safeParse(rawPayload);
                if (!payload.success) {
                    logger.error("Auth: Token Structure mismatch", {
                        err: prettifyError(payload.error),
                    });
                    return status(401, "Unauthorized");
                }

                const user = payload.data;

                if (user.type !== "staff") {
                    logger.warn("Auth: User type does not support permissions", {
                        userId: user.id,
                        type: user.type,
                    });
                    return status(403, "Forbidden");
                }

                const staff = await prisma.staff.findUnique({
                    where: { id: user.id },
                    select: {
                        id: true,
                        role: {
                            select: {
                                permissions: true,
                            },
                        },
                    },
                });

                if (!staff) {
                    logger.warn("Auth: Staff not found in database", {
                        staffId: user.id,
                    });
                    return status(401, "Unauthorized");
                }

                const userPermissions = staff.role.permissions as Permission[];
                const hasAllRequired = requiredPermissions.every((p) =>
                    hasPermission(userPermissions, p),
                );

                if (!hasAllRequired) {
                    logger.warn("Auth: Insufficient permissions", {
                        staffId: user.id,
                        required: requiredPermissions,
                        actual: userPermissions,
                    });
                    return status(403, "Forbidden");
                }

                return {
                    user,
                    type: user.type,
                    permissions: userPermissions,
                };
            },
        }),
    })
    .as("scoped");
