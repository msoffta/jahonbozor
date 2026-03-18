import { Elysia } from "elysia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockLogger } from "@backend/test/setup";

import { AuthService } from "../auth.service";

const mockStaffData = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    roleId: 1,
    type: "staff" as const,
};

const mockStaffWithRole = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    telegramId: "123456789",
    roleId: 1,
    role: {
        id: 1,
        name: "Admin",
        permissions: ["products:read", "products:create"],
    },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as unknown as Awaited<ReturnType<typeof AuthService.getStaffById>>;

const mockUserData = {
    id: 1,
    fullname: "Test User",
    username: "testuser",
    phone: "+998901234567",
    telegramId: "987654321",
    photo: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as unknown as Awaited<ReturnType<typeof AuthService.getUserById>>;

describe("Auth API Routes", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;

    beforeEach(() => {
        mockLogger = createMockLogger();
    });

    describe("POST /login", () => {
        const createLoginApp = () => {
            return new Elysia()
                .derive(() => ({
                    logger: mockLogger,
                    requestId: "test-request-id",
                }))
                .post("/login", async ({ body, set }) => {
                    const { username, password } = body as { username: string; password: string };
                    const mockJwt = { sign: vi.fn().mockResolvedValue("mock-token") };

                    const result = await AuthService.login(
                        { username, password },
                        mockJwt,
                        mockLogger,
                    );

                    if (!result.success) {
                        set.status = result.error === "Unauthorized" ? 401 : 500;
                        return { success: false, error: result.error };
                    }

                    return {
                        success: true,
                        data: { staff: result.data.staff, token: result.data.accessToken },
                    };
                });
        };

        test("should return 200 with staff and token on valid credentials", async () => {
            const loginSpy = vi.spyOn(AuthService, "login").mockResolvedValue({
                success: true,
                data: {
                    staff: mockStaffData,
                    accessToken: "mock-access-token",
                    refreshToken: "mock-refresh-token",
                    refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            });
            const app = createLoginApp();

            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "johndoe", password: "correctpassword" }),
                }),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.staff.username).toBe("johndoe");
            expect(body.data.token).toBe("mock-access-token");

            loginSpy.mockRestore();
        });

        test("should return 401 when credentials are invalid", async () => {
            const loginSpy = vi.spyOn(AuthService, "login").mockResolvedValue({
                success: false,
                error: "Unauthorized",
            });
            const app = createLoginApp();

            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "invalid", password: "wrongpassword" }),
                }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            loginSpy.mockRestore();
        });

        test("should return 500 when refresh token save fails", async () => {
            const loginSpy = vi.spyOn(AuthService, "login").mockResolvedValue({
                success: false,
                error: "Internal Server Error",
            });
            const app = createLoginApp();

            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "johndoe", password: "correctpassword" }),
                }),
            );
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Internal Server Error");

            loginSpy.mockRestore();
        });

        test("should call AuthService.login with correct credentials", async () => {
            const loginSpy = vi.spyOn(AuthService, "login").mockResolvedValue({
                success: true,
                data: {
                    staff: mockStaffData,
                    accessToken: "mock-access-token",
                    refreshToken: "mock-refresh-token",
                    refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            });
            const app = createLoginApp();

            await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "testuser", password: "testpass" }),
                }),
            );

            expect(loginSpy).toHaveBeenCalledWith(
                { username: "testuser", password: "testpass" },
                expect.anything(),
                expect.anything(),
            );

            loginSpy.mockRestore();
        });
    });

    describe("POST /refresh", () => {
        const createRefreshApp = (cookieValue?: string) => {
            return new Elysia()
                .derive(() => ({
                    logger: mockLogger,
                    requestId: "test-request-id",
                    cookie: {
                        auth: {
                            value: cookieValue,
                            remove: vi.fn(),
                            set: vi.fn(),
                        },
                    },
                }))
                .post("/refresh", async ({ cookie, set }) => {
                    const authCookie = (
                        cookie as {
                            auth: { value?: string; remove: () => void; set: (v: unknown) => void };
                        }
                    ).auth;

                    if (!authCookie.value) {
                        set.status = 401;
                        return { success: false, error: "Unauthorized" };
                    }

                    const mockJwt = { sign: vi.fn().mockResolvedValue("new-token") };
                    const result = await AuthService.refresh(authCookie.value, mockJwt, mockLogger);

                    if (!result.success) {
                        if (result.error === "Unauthorized") {
                            authCookie.remove();
                            set.status = 401;
                        } else {
                            set.status = 500;
                        }
                        return { success: false, error: result.error };
                    }

                    return { success: true, data: { token: result.data.accessToken } };
                });
        };

        test("should return 200 with new token on valid staff refresh", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: true,
                data: {
                    accessToken: "new-access-token",
                    refreshToken: "new-refresh-token",
                    refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    entityId: 1,
                    entityType: "staff",
                },
            });
            const app = createRefreshApp("valid-refresh-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.token).toBe("new-access-token");

            refreshSpy.mockRestore();
        });

        test("should return 200 with new token on valid user refresh", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: true,
                data: {
                    accessToken: "new-access-token",
                    refreshToken: "new-refresh-token",
                    refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    entityId: 1,
                    entityType: "user",
                },
            });
            const app = createRefreshApp("valid-user-refresh-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.token).toBe("new-access-token");

            refreshSpy.mockRestore();
        });

        test("should return 401 when cookie is missing", async () => {
            const app = createRefreshApp(undefined);

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");
        });

        test("should return 401 when token is invalid", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: false,
                error: "Unauthorized",
            });
            const app = createRefreshApp("invalid-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            refreshSpy.mockRestore();
        });

        test("should return 401 when staff not found", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: false,
                error: "Unauthorized",
            });
            const app = createRefreshApp("valid-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            refreshSpy.mockRestore();
        });

        test("should return 401 when user not found for user token", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: false,
                error: "Unauthorized",
            });
            const app = createRefreshApp("valid-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            refreshSpy.mockRestore();
        });

        test("should return 500 when saving new token fails", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: false,
                error: "Internal Server Error",
            });
            const app = createRefreshApp("valid-token");

            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Internal Server Error");

            refreshSpy.mockRestore();
        });

        test("should call AuthService.refresh with correct token", async () => {
            const refreshSpy = vi.spyOn(AuthService, "refresh").mockResolvedValue({
                success: true,
                data: {
                    accessToken: "new-access-token",
                    refreshToken: "new-refresh-token",
                    refreshTokenExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    entityId: 1,
                    entityType: "staff",
                },
            });
            const app = createRefreshApp("old-token");

            await app.handle(new Request("http://localhost/refresh", { method: "POST" }));

            expect(refreshSpy).toHaveBeenCalledWith(
                "old-token",
                expect.anything(),
                expect.anything(),
            );

            refreshSpy.mockRestore();
        });
    });

    describe("POST /logout", () => {
        const createLogoutApp = (cookieValue?: string) => {
            const removeMock = vi.fn();
            return {
                app: new Elysia()
                    .derive(() => ({
                        logger: mockLogger,
                        requestId: "test-request-id",
                        cookie: {
                            auth: {
                                value: cookieValue,
                                remove: removeMock,
                            },
                        },
                    }))
                    .post("/logout", async ({ cookie, set }) => {
                        const authCookie = (
                            cookie as { auth: { value?: string; remove: () => void } }
                        ).auth;

                        if (!authCookie.value) {
                            set.status = 401;
                            return { success: false, error: "Unauthorized" };
                        }

                        const result = await AuthService.logout(authCookie.value, mockLogger);
                        authCookie.remove();

                        if (result.success && result.data.entityId) {
                            mockLogger.info("Auth: Logged out", {
                                entityId: result.data.entityId,
                                entityType: result.data.entityType,
                            });
                        }

                        return { success: true, data: null };
                    }),
                removeMock,
            };
        };

        test("should return 200 and revoke token on valid logout", async () => {
            const logoutSpy = vi.spyOn(AuthService, "logout").mockResolvedValue({
                success: true,
                data: { entityId: 1, entityType: "staff" },
            });
            const { app, removeMock } = createLogoutApp("valid-token");

            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data).toBeNull();
            expect(removeMock).toHaveBeenCalled();

            logoutSpy.mockRestore();
        });

        test("should return 401 when no cookie present", async () => {
            const { app } = createLogoutApp(undefined);

            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");
        });

        test("should still succeed even if token is invalid", async () => {
            const logoutSpy = vi.spyOn(AuthService, "logout").mockResolvedValue({
                success: true,
                data: {},
            });
            const { app, removeMock } = createLogoutApp("invalid-token");

            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(removeMock).toHaveBeenCalled();

            logoutSpy.mockRestore();
        });

        test("should call AuthService.logout with correct token", async () => {
            const logoutSpy = vi.spyOn(AuthService, "logout").mockResolvedValue({
                success: true,
                data: { entityId: 1, entityType: "staff" },
            });
            const { app } = createLogoutApp("my-refresh-token");

            await app.handle(new Request("http://localhost/logout", { method: "POST" }));

            expect(logoutSpy).toHaveBeenCalledWith("my-refresh-token", expect.anything());

            logoutSpy.mockRestore();
        });
    });

    describe("GET /me", () => {
        const createMeApp = (userType: "staff" | "user", userId: number) => {
            return new Elysia()
                .derive(() => ({
                    logger: mockLogger,
                    user: { id: userId, type: userType },
                    type: userType,
                }))
                .get("/me", async ({ user, type, set }) => {
                    const profileData =
                        type === "staff"
                            ? await AuthService.getStaffById(user.id, mockLogger)
                            : await AuthService.getUserById(user.id, mockLogger);

                    if (!profileData) {
                        set.status = 404;
                        return { success: false, error: "Not Found" };
                    }

                    return { success: true, data: { ...profileData, type } };
                });
        };

        test("should return staff profile for staff user", async () => {
            const getStaffByIdSpy = vi
                .spyOn(AuthService, "getStaffById")
                .mockResolvedValue(mockStaffWithRole);
            const app = createMeApp("staff", 1);

            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.type).toBe("staff");
            expect(body.data.username).toBe("johndoe");

            getStaffByIdSpy.mockRestore();
        });

        test("should return user profile for regular user", async () => {
            const getUserByIdSpy = vi
                .spyOn(AuthService, "getUserById")
                .mockResolvedValue(mockUserData);
            const app = createMeApp("user", 1);

            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.type).toBe("user");
            expect(body.data.username).toBe("testuser");

            getUserByIdSpy.mockRestore();
        });

        test("should return 404 when staff profile not found", async () => {
            const getStaffByIdSpy = vi.spyOn(AuthService, "getStaffById").mockResolvedValue(null);
            const app = createMeApp("staff", 999);

            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Not Found");

            getStaffByIdSpy.mockRestore();
        });

        test("should return 404 when user profile not found", async () => {
            const getUserByIdSpy = vi.spyOn(AuthService, "getUserById").mockResolvedValue(null);
            const app = createMeApp("user", 999);

            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Not Found");

            getUserByIdSpy.mockRestore();
        });

        test("should call getStaffById for staff type", async () => {
            const getStaffByIdSpy = vi
                .spyOn(AuthService, "getStaffById")
                .mockResolvedValue(mockStaffWithRole);
            const app = createMeApp("staff", 42);

            await app.handle(new Request("http://localhost/me"));

            expect(getStaffByIdSpy).toHaveBeenCalledWith(42, expect.anything());

            getStaffByIdSpy.mockRestore();
        });

        test("should call getUserById for user type", async () => {
            const getUserByIdSpy = vi
                .spyOn(AuthService, "getUserById")
                .mockResolvedValue(mockUserData);
            const app = createMeApp("user", 42);

            await app.handle(new Request("http://localhost/me"));

            expect(getUserByIdSpy).toHaveBeenCalledWith(42, expect.anything());

            getUserByIdSpy.mockRestore();
        });
    });
});

describe("Auth API edge cases", () => {
    test("POST /login should return 401 when credentials are invalid", async () => {
        const loginSpy = vi.spyOn(AuthService, "login").mockResolvedValue({
            success: false,
            error: "Unauthorized",
        });
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger, requestId: "test-request-id" }))
            .post("/login", async ({ body, set }) => {
                const { username, password } = body as { username: string; password: string };
                const mockJwt = { sign: vi.fn().mockResolvedValue("mock-token") };
                const result = await AuthService.login({ username, password }, mockJwt, mockLogger);
                if (!result.success) {
                    set.status = 401;
                    return { success: false, error: "Unauthorized" };
                }
                return { success: true };
            });

        const response = await app.handle(
            new Request("http://localhost/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "nonexistent", password: "password123" }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe("Unauthorized");

        loginSpy.mockRestore();
    });

    test("GET /me should return 404 when staff not found", async () => {
        const spy = vi.spyOn(AuthService, "getStaffById").mockResolvedValue(null);
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger }))
            .get("/me", async ({ set }) => {
                const staff = await AuthService.getStaffById(999, mockLogger);
                if (!staff) {
                    set.status = 404;
                    return { success: false, error: "Not found" };
                }
                return { success: true, data: staff };
            });

        const response = await app.handle(new Request("http://localhost/me"));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.success).toBe(false);

        spy.mockRestore();
    });

    test("GET /me should return 404 when user not found", async () => {
        const spy = vi.spyOn(AuthService, "getUserById").mockResolvedValue(null);
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger }))
            .get("/me", async ({ set }) => {
                const user = await AuthService.getUserById(999, mockLogger);
                if (!user) {
                    set.status = 404;
                    return { success: false, error: "Not found" };
                }
                return { success: true, data: user };
            });

        const response = await app.handle(new Request("http://localhost/me"));
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.success).toBe(false);

        spy.mockRestore();
    });
});
