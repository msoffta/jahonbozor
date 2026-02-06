import { SignInBody } from "@jahonbozor/schemas";
import { ReturnSchema } from "@jahonbozor/schemas/src/base.model";
import { Elysia, t } from "elysia";
import Auth from "./auth.service";
import jwt from "@elysiajs/jwt";
import dayjs from "dayjs";
import { authMiddleware } from "@lib/middleware";
import { requestContext } from "@lib/request-context";
import { audit } from "@lib/audit";

const authCookieSchema = t.Cookie({
    auth: t.Optional(t.String()),
});

export const auth = new Elysia({ prefix: "/auth" })
    .use(requestContext)
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET!,
        }),
    )
    .post(
        "/login",
        async ({ body, cookie: { auth }, jwt, set, logger, requestId }): Promise<ReturnSchema> => {
            try {
                const username = body.username;
                const password = body.password;

                const staff = await Auth.checkIfStaffExists(
                    { username, password },
                    logger,
                );

                if (!staff) {
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const refreshTokenExp = dayjs().add(30, "day");

                const refreshToken = await jwt.sign({
                    id: staff.id,
                    type: staff.type,
                    exp: refreshTokenExp.unix(),
                });

                const accessToken = await jwt.sign({
                    id: staff.id,
                    fullname: staff.fullname,
                    username: staff.username,
                    roleId: staff.roleId,
                    type: staff.type,
                    exp: dayjs().add(15, "minute").unix(),
                });

                const isRefreshTokenSaved = await Auth.saveRefreshToken(
                    { token: refreshToken, exp: refreshTokenExp.toDate(), staffId: staff.id },
                    logger,
                );

                if (!isRefreshTokenSaved) {
                    logger.error("Auth: Refresh token not saved", {
                        staffId: staff.id,
                    });
                    set.status = 500;
                    return { success: false, error: "Internal Server Error" };
                }

                auth.set({
                    path: "/api/public/auth",
                    secure: process.env.NODE_ENV !== "development",
                    httpOnly: true,
                    expires: refreshTokenExp.toDate(),
                    maxAge: 30 * 24 * 60 * 60,
                    value: refreshToken,
                    sameSite: true,
                });

                await audit(
                    { requestId, user: { id: staff.id, type: "staff" } as import("@jahonbozor/schemas").Token, logger },
                    {
                        entityType: "staff",
                        entityId: staff.id,
                        action: "LOGIN",
                        newData: { username: staff.username, fullname: staff.fullname },
                    },
                );

                logger.info("Auth: Staff logged in", {
                    staffId: staff.id,
                    username,
                });
                return {
                    success: true,
                    data: { staff, token: accessToken },
                };
            } catch (error) {
                logger.error("Auth: Unhandled error in POST /login", {
                    username: body.username,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        {
            body: SignInBody,
            cookie: authCookieSchema,
        },
    )
    .post(
        "/refresh",
        async ({ cookie: { auth }, jwt, set, logger, requestId }): Promise<ReturnSchema> => {
            try {
                if (!auth.value) {
                    logger.warn("Auth: Refresh token cookie not found");
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const refreshTokenValue = auth.value;

                const tokenRecord = await Auth.validateRefreshToken(refreshTokenValue, logger);
                if (!tokenRecord || !tokenRecord.staffId) {
                    auth.remove();
                    logger.warn("Auth: Invalid or non-staff refresh token");
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const staffData = await Auth.getStaffById(tokenRecord.staffId, logger);
                if (!staffData) {
                    auth.remove();
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                await Auth.revokeRefreshToken(refreshTokenValue, logger);

                const newRefreshTokenExpiration = dayjs().add(30, "day");

                const newRefreshTokenValue = await jwt.sign({
                    id: staffData.id,
                    type: "staff",
                    exp: newRefreshTokenExpiration.unix(),
                });

                const newAccessToken = await jwt.sign({
                    id: staffData.id,
                    fullname: staffData.fullname,
                    username: staffData.username,
                    roleId: staffData.roleId,
                    type: "staff",
                    exp: dayjs().add(15, "minute").unix(),
                });

                const isRefreshTokenSaved = await Auth.saveRefreshToken(
                    {
                        token: newRefreshTokenValue,
                        exp: newRefreshTokenExpiration.toDate(),
                        staffId: staffData.id,
                    },
                    logger,
                );

                if (!isRefreshTokenSaved) {
                    logger.error("Auth: Failed to save new refresh token", {
                        staffId: staffData.id,
                    });
                    set.status = 500;
                    return { success: false, error: "Internal Server Error" };
                }

                auth.set({
                    path: "/api/public/auth",
                    secure: process.env.NODE_ENV !== "development",
                    httpOnly: true,
                    expires: newRefreshTokenExpiration.toDate(),
                    maxAge: 30 * 24 * 60 * 60,
                    value: newRefreshTokenValue,
                    sameSite: true,
                });

                await audit(
                    { requestId, user: { id: staffData.id, type: "staff" } as import("@jahonbozor/schemas").Token, logger },
                    {
                        entityType: "refreshToken",
                        entityId: staffData.id,
                        action: "UPDATE",
                    },
                );

                logger.info("Auth: Token refreshed", { staffId: staffData.id });
                return { success: true, data: { token: newAccessToken } };
            } catch (error) {
                logger.error("Auth: Unhandled error in POST /refresh", {
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { cookie: authCookieSchema },
    )
    .post(
        "/logout",
        async ({ cookie: { auth }, set, logger, requestId }): Promise<ReturnSchema> => {
            try {
                if (!auth.value) {
                    logger.warn("Auth: Logout attempted without token");
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const refreshTokenValue = auth.value;

                const tokenRecord = await Auth.validateRefreshToken(refreshTokenValue, logger);

                await Auth.revokeRefreshToken(refreshTokenValue, logger);

                auth.remove();

                if (tokenRecord?.staffId) {
                    await audit(
                        { requestId, user: { id: tokenRecord.staffId, type: "staff" } as import("@jahonbozor/schemas").Token, logger },
                        {
                            entityType: "staff",
                            entityId: tokenRecord.staffId,
                            action: "LOGOUT",
                        },
                    );
                    logger.info("Auth: Staff logged out", { staffId: tokenRecord.staffId });
                } else if (tokenRecord?.userId) {
                    await audit(
                        { requestId, user: { id: tokenRecord.userId, type: "user" } as import("@jahonbozor/schemas").Token, logger },
                        {
                            entityType: "user",
                            entityId: tokenRecord.userId,
                            action: "LOGOUT",
                        },
                    );
                    logger.info("Auth: User logged out", { userId: tokenRecord.userId });
                } else {
                    logger.info("Auth: Token revoked (no valid session)");
                }

                return { success: true, data: null };
            } catch (error) {
                logger.error("Auth: Unhandled error in POST /logout", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { cookie: authCookieSchema },
    )
    .use(authMiddleware)
    .get(
        "/me",
        async ({ user, type, set, logger }): Promise<ReturnSchema> => {
            try {
                const profileData =
                    type === "staff"
                        ? await Auth.getStaffById(user.id, logger)
                        : await Auth.getUserById(user.id, logger);

                if (!profileData) {
                    logger.warn("Auth: Profile not found", {
                        userId: user.id,
                        type,
                    });
                    set.status = 404;
                    return { success: false, error: "Not Found" };
                }

                return { success: true, data: { ...profileData, type } };
            } catch (error) {
                logger.error("Auth: Unhandled error in GET /me", {
                    userId: user.id,
                    type,
                    error,
                });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { auth: true },
    );
