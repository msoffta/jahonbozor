import { describe, test, expect, beforeEach, spyOn, mock } from "bun:test";
import { Elysia } from "elysia";
import { createMockLogger } from "@backend/test/setup";
import Auth from "../auth.service";

const mockStaffData = {
    id: 1,
    fullname: "John Doe",
    username: "johndoe",
    passwordHash: "$argon2id$v=19$hash",
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
} as unknown as Awaited<ReturnType<typeof Auth.getStaffById>>;

const mockUserData = {
    id: 1,
    fullname: "Test User",
    username: "testuser",
    phone: "+998901234567",
    telegramId: "987654321",
    photo: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
} as unknown as Awaited<ReturnType<typeof Auth.getUserById>>;

const mockTokenRecord = {
    id: 1,
    staffId: 1,
    userId: null,
    revoked: false,
    expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

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

                    const staff = await Auth.checkIfStaffExists({ username, password }, mockLogger);

                    if (!staff) {
                        set.status = 401;
                        return { success: false, error: "Unauthorized" };
                    }

                    const isRefreshTokenSaved = await Auth.saveRefreshToken(
                        {
                            token: "mock-refresh-token",
                            exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                            staffId: staff.id,
                        },
                        mockLogger,
                    );

                    if (!isRefreshTokenSaved) {
                        set.status = 500;
                        return { success: false, error: "Internal Server Error" };
                    }

                    return {
                        success: true,
                        data: { staff, token: "mock-access-token" },
                    };
                });
        };

        test("should return 200 with staff and token on valid credentials", async () => {
            // Arrange
            const checkIfStaffExistsSpy = spyOn(Auth, "checkIfStaffExists").mockResolvedValue(mockStaffData);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(true);
            const app = createLoginApp();

            // Act
            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "johndoe", password: "correctpassword" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.staff.username).toBe("johndoe");
            expect(body.data.token).toBe("mock-access-token");

            checkIfStaffExistsSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });

        test("should return 401 when credentials are invalid", async () => {
            // Arrange
            const checkIfStaffExistsSpy = spyOn(Auth, "checkIfStaffExists").mockResolvedValue(null);
            const app = createLoginApp();

            // Act
            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "invalid", password: "wrongpassword" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            checkIfStaffExistsSpy.mockRestore();
        });

        test("should return 500 when refresh token save fails", async () => {
            // Arrange
            const checkIfStaffExistsSpy = spyOn(Auth, "checkIfStaffExists").mockResolvedValue(mockStaffData);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(null);
            const app = createLoginApp();

            // Act
            const response = await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "johndoe", password: "correctpassword" }),
                }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Internal Server Error");

            checkIfStaffExistsSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });

        test("should call checkIfStaffExists with correct credentials", async () => {
            // Arrange
            const checkIfStaffExistsSpy = spyOn(Auth, "checkIfStaffExists").mockResolvedValue(mockStaffData);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(true);
            const app = createLoginApp();

            // Act
            await app.handle(
                new Request("http://localhost/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: "testuser", password: "testpass" }),
                }),
            );

            // Assert
            expect(checkIfStaffExistsSpy).toHaveBeenCalledWith(
                { username: "testuser", password: "testpass" },
                expect.anything(),
            );

            checkIfStaffExistsSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
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
                            remove: mock(() => {}),
                            set: mock(() => {}),
                        },
                    },
                }))
                .post("/refresh", async ({ cookie, set }) => {
                    const authCookie = (cookie as { auth: { value?: string; remove: () => void } }).auth;

                    if (!authCookie.value) {
                        set.status = 401;
                        return { success: false, error: "Unauthorized" };
                    }

                    const tokenRecord = await Auth.validateRefreshToken(authCookie.value, mockLogger);
                    if (!tokenRecord || (!tokenRecord.staffId && !tokenRecord.userId)) {
                        authCookie.remove();
                        set.status = 401;
                        return { success: false, error: "Unauthorized" };
                    }

                    await Auth.revokeRefreshToken(authCookie.value, mockLogger);

                    if (tokenRecord.staffId) {
                        const staffData = await Auth.getStaffById(tokenRecord.staffId, mockLogger);
                        if (!staffData) {
                            authCookie.remove();
                            set.status = 401;
                            return { success: false, error: "Unauthorized" };
                        }

                        const isRefreshTokenSaved = await Auth.saveRefreshToken(
                            {
                                token: "new-refresh-token",
                                exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                staffId: staffData.id,
                            },
                            mockLogger,
                        );

                        if (!isRefreshTokenSaved) {
                            set.status = 500;
                            return { success: false, error: "Internal Server Error" };
                        }
                    } else {
                        const userData = await Auth.getUserById(tokenRecord.userId!, mockLogger);
                        if (!userData) {
                            authCookie.remove();
                            set.status = 401;
                            return { success: false, error: "Unauthorized" };
                        }

                        const isRefreshTokenSaved = await Auth.saveRefreshToken(
                            {
                                token: "new-refresh-token",
                                exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                userId: userData.id,
                            },
                            mockLogger,
                        );

                        if (!isRefreshTokenSaved) {
                            set.status = 500;
                            return { success: false, error: "Internal Server Error" };
                        }
                    }

                    return { success: true, data: { token: "new-access-token" } };
                });
        };

        test("should return 200 with new token on valid staff refresh", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(mockStaffWithRole);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(true);
            const app = createRefreshApp("valid-refresh-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.token).toBe("new-access-token");

            validateRefreshTokenSpy.mockRestore();
            getStaffByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });

        test("should return 200 with new token on valid user refresh", async () => {
            // Arrange
            const userTokenRecord = { id: 2, staffId: null, userId: 1, revoked: false, expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(userTokenRecord);
            const getUserByIdSpy = spyOn(Auth, "getUserById").mockResolvedValue(mockUserData);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(true);
            const app = createRefreshApp("valid-user-refresh-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.token).toBe("new-access-token");
            expect(getUserByIdSpy).toHaveBeenCalledWith(1, expect.anything());

            validateRefreshTokenSpy.mockRestore();
            getUserByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });

        test("should return 401 when cookie is missing", async () => {
            // Arrange
            const app = createRefreshApp(undefined);

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");
        });

        test("should return 401 when token is invalid", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(null);
            const app = createRefreshApp("invalid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            validateRefreshTokenSpy.mockRestore();
        });

        test("should return 401 when staff not found", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(null);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const app = createRefreshApp("valid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            validateRefreshTokenSpy.mockRestore();
            getStaffByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
        });

        test("should return 401 when user not found for user token", async () => {
            // Arrange
            const userTokenRecord = { id: 2, staffId: null, userId: 999, revoked: false, expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(userTokenRecord);
            const getUserByIdSpy = spyOn(Auth, "getUserById").mockResolvedValue(null);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const app = createRefreshApp("valid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");

            validateRefreshTokenSpy.mockRestore();
            getUserByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
        });

        test("should return 500 when saving new token fails", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(mockStaffWithRole);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(null);
            const app = createRefreshApp("valid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/refresh", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Internal Server Error");

            validateRefreshTokenSpy.mockRestore();
            getStaffByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });

        test("should revoke old token before issuing new one", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(mockStaffWithRole);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const saveRefreshTokenSpy = spyOn(Auth, "saveRefreshToken").mockResolvedValue(true);
            const app = createRefreshApp("old-token");

            // Act
            await app.handle(new Request("http://localhost/refresh", { method: "POST" }));

            // Assert
            expect(revokeRefreshTokenSpy).toHaveBeenCalledWith("old-token", expect.anything());

            validateRefreshTokenSpy.mockRestore();
            getStaffByIdSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
            saveRefreshTokenSpy.mockRestore();
        });
    });

    describe("POST /logout", () => {
        const createLogoutApp = (cookieValue?: string) => {
            const removeMock = mock(() => {});
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
                        const authCookie = (cookie as { auth: { value?: string; remove: () => void } }).auth;

                        if (!authCookie.value) {
                            set.status = 401;
                            return { success: false, error: "Unauthorized" };
                        }

                        const tokenRecord = await Auth.validateRefreshToken(authCookie.value, mockLogger);

                        await Auth.revokeRefreshToken(authCookie.value, mockLogger);

                        authCookie.remove();

                        if (tokenRecord?.staffId) {
                            mockLogger.info("Auth: Staff logged out", { staffId: tokenRecord.staffId });
                        } else if (tokenRecord?.userId) {
                            mockLogger.info("Auth: User logged out", { userId: tokenRecord.userId });
                        }

                        return { success: true, data: null };
                    }),
                removeMock,
            };
        };

        test("should return 200 and revoke token on valid logout", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const { app, removeMock } = createLogoutApp("valid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data).toBeNull();
            expect(revokeRefreshTokenSpy).toHaveBeenCalledWith("valid-token", expect.anything());
            expect(removeMock).toHaveBeenCalled();

            validateRefreshTokenSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
        });

        test("should return 401 when no cookie present", async () => {
            // Arrange
            const { app } = createLogoutApp(undefined);

            // Act
            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(401);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Unauthorized");
        });

        test("should still succeed even if token is invalid", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(null);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const { app, removeMock } = createLogoutApp("invalid-token");

            // Act
            const response = await app.handle(
                new Request("http://localhost/logout", { method: "POST" }),
            );
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(removeMock).toHaveBeenCalled();

            validateRefreshTokenSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
        });

        test("should call revokeRefreshToken with correct token", async () => {
            // Arrange
            const validateRefreshTokenSpy = spyOn(Auth, "validateRefreshToken").mockResolvedValue(mockTokenRecord);
            const revokeRefreshTokenSpy = spyOn(Auth, "revokeRefreshToken").mockResolvedValue(undefined);
            const { app } = createLogoutApp("my-refresh-token");

            // Act
            await app.handle(new Request("http://localhost/logout", { method: "POST" }));

            // Assert
            expect(revokeRefreshTokenSpy).toHaveBeenCalledWith("my-refresh-token", expect.anything());

            validateRefreshTokenSpy.mockRestore();
            revokeRefreshTokenSpy.mockRestore();
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
                            ? await Auth.getStaffById(user.id, mockLogger)
                            : await Auth.getUserById(user.id, mockLogger);

                    if (!profileData) {
                        set.status = 404;
                        return { success: false, error: "Not Found" };
                    }

                    return { success: true, data: { ...profileData, type } };
                });
        };

        test("should return staff profile for staff user", async () => {
            // Arrange
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(mockStaffWithRole);
            const app = createMeApp("staff", 1);

            // Act
            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.type).toBe("staff");
            expect(body.data.username).toBe("johndoe");

            getStaffByIdSpy.mockRestore();
        });

        test("should return user profile for regular user", async () => {
            // Arrange
            const getUserByIdSpy = spyOn(Auth, "getUserById").mockResolvedValue(mockUserData);
            const app = createMeApp("user", 1);

            // Act
            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.type).toBe("user");
            expect(body.data.username).toBe("testuser");

            getUserByIdSpy.mockRestore();
        });

        test("should return 404 when staff profile not found", async () => {
            // Arrange
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(null);
            const app = createMeApp("staff", 999);

            // Act
            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Not Found");

            getStaffByIdSpy.mockRestore();
        });

        test("should return 404 when user profile not found", async () => {
            // Arrange
            const getUserByIdSpy = spyOn(Auth, "getUserById").mockResolvedValue(null);
            const app = createMeApp("user", 999);

            // Act
            const response = await app.handle(new Request("http://localhost/me"));
            const body = await response.json();

            // Assert
            expect(response.status).toBe(404);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Not Found");

            getUserByIdSpy.mockRestore();
        });

        test("should call getStaffById for staff type", async () => {
            // Arrange
            const getStaffByIdSpy = spyOn(Auth, "getStaffById").mockResolvedValue(mockStaffWithRole);
            const app = createMeApp("staff", 42);

            // Act
            await app.handle(new Request("http://localhost/me"));

            // Assert
            expect(getStaffByIdSpy).toHaveBeenCalledWith(42, expect.anything());

            getStaffByIdSpy.mockRestore();
        });

        test("should call getUserById for user type", async () => {
            // Arrange
            const getUserByIdSpy = spyOn(Auth, "getUserById").mockResolvedValue(mockUserData);
            const app = createMeApp("user", 42);

            // Act
            await app.handle(new Request("http://localhost/me"));

            // Assert
            expect(getUserByIdSpy).toHaveBeenCalledWith(42, expect.anything());

            getUserByIdSpy.mockRestore();
        });
    });
});

describe("Auth API edge cases", () => {
    test("POST /login should return 401 when credentials are invalid", async () => {
        const spy = spyOn(Auth, "checkIfStaffExists").mockResolvedValue(null);
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger, requestId: "test-request-id" }))
            .post("/login", async ({ body, set }) => {
                const { username, password } = body as { username: string; password: string };
                const staff = await Auth.checkIfStaffExists({ username, password }, mockLogger);
                if (!staff) {
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

        spy.mockRestore();
    });

    test("GET /me should return 404 when staff not found", async () => {
        const spy = spyOn(Auth, "getStaffById").mockResolvedValue(null);
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger }))
            .get("/me", async ({ set }) => {
                const staff = await Auth.getStaffById(999, mockLogger);
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
        const spy = spyOn(Auth, "getUserById").mockResolvedValue(null);
        const mockLogger = createMockLogger();

        const app = new Elysia()
            .derive(() => ({ logger: mockLogger }))
            .get("/me", async ({ set }) => {
                const user = await Auth.getUserById(999, mockLogger);
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
