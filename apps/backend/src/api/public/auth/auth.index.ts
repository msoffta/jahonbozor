import jwt from "@elysiajs/jwt";
import { Elysia, t } from "elysia";

import { SignInBody } from "@jahonbozor/schemas";

import { audit } from "@backend/lib/audit";
import { authMiddleware } from "@backend/lib/middleware";
import { requestContext } from "@backend/lib/request-context";

import { AuthService } from "./auth.service";

import type { Token } from "@jahonbozor/schemas";
import type {
    LoginResponse,
    LogoutResponse,
    ProfileResponse,
    RefreshResponse,
} from "@jahonbozor/schemas/src/auth";

const authCookieSchema = t.Cookie({
    auth: t.Optional(t.String()),
});

const COOKIE_OPTIONS = {
    path: "/api/public/auth",
    secure: process.env.NODE_ENV !== "development",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    sameSite: true,
} as const;

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
        async ({ body, cookie: { auth }, jwt, set, logger, requestId }): Promise<LoginResponse> => {
            try {
                const result = await AuthService.login(body, jwt, logger);

                if (!result.success) {
                    set.status = result.error === "Unauthorized" ? 401 : 500;
                    return { success: false, error: result.error };
                }

                const { staff, accessToken, refreshToken, refreshTokenExp } = result.data;

                auth.set({ ...COOKIE_OPTIONS, expires: refreshTokenExp, value: refreshToken });

                await audit(
                    { requestId, user: { id: staff.id, type: "staff" } as Token, logger },
                    {
                        entityType: "staff",
                        entityId: staff.id,
                        action: "LOGIN",
                        newData: { username: staff.username, fullname: staff.fullname },
                    },
                );

                return { success: true, data: { staff, token: accessToken } };
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
        async ({ cookie: { auth }, jwt, set, logger, requestId }): Promise<RefreshResponse> => {
            try {
                if (!auth.value) {
                    logger.warn("Auth: Refresh token cookie not found");
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const result = await AuthService.refresh(auth.value, jwt, logger);

                if (!result.success) {
                    if (result.error === "Unauthorized") {
                        auth.remove();
                        set.status = 401;
                    } else {
                        set.status = 500;
                    }
                    return { success: false, error: result.error };
                }

                const { accessToken, refreshToken, refreshTokenExp, entityId, entityType } =
                    result.data;

                auth.set({ ...COOKIE_OPTIONS, expires: refreshTokenExp, value: refreshToken });

                await audit(
                    { requestId, user: { id: entityId, type: entityType } as Token, logger },
                    {
                        entityType: "refreshToken",
                        entityId,
                        action: "UPDATE",
                    },
                );

                return { success: true, data: { token: accessToken } };
            } catch (error) {
                logger.error("Auth: Unhandled error in POST /refresh", { error });
                set.status = 500;
                return { success: false, error: "Internal Server Error" };
            }
        },
        { cookie: authCookieSchema },
    )
    .post(
        "/logout",
        async ({ cookie: { auth }, set, logger, requestId }): Promise<LogoutResponse> => {
            try {
                if (!auth.value) {
                    logger.warn("Auth: Logout attempted without token");
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }

                const result = await AuthService.logout(auth.value, logger);
                auth.remove();

                if (result.success && result.data.entityId && result.data.entityType) {
                    await audit(
                        {
                            requestId,
                            user: {
                                id: result.data.entityId,
                                type: result.data.entityType,
                            } as Token,
                            logger,
                        },
                        {
                            entityType: result.data.entityType === "staff" ? "staff" : "user",
                            entityId: result.data.entityId,
                            action: "LOGOUT",
                        },
                    );
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
        async ({ user, type, set, logger }): Promise<ProfileResponse> => {
            try {
                const profileData =
                    type === "staff"
                        ? await AuthService.getStaffById(user.id, logger)
                        : await AuthService.getUserById(user.id, logger);

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
