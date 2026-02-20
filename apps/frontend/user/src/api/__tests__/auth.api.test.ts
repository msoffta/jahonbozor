import { describe, test, expect, beforeEach, mock } from "bun:test";
import { useAuthStore } from "@/stores/auth.store";

// Mock api-client before importing auth.api
const mockGet = mock(() => Promise.resolve({ data: { success: true, data: { id: 1, fullname: "Test" } }, error: null }));
const mockPost = mock(() => Promise.resolve({ data: { success: true, data: {} }, error: null }));

mock.module("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                auth: {
                    me: { get: mockGet },
                    logout: { post: mockPost },
                },
                users: {
                    telegram: { post: mockPost },
                },
            },
        },
    },
}));

import { authKeys, profileOptions } from "../auth.api";

describe("auth.api", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            isAuthenticated: false,
        });
        mock.restore();
    });

    describe("authKeys", () => {
        test("should have correct me key", () => {
            expect(authKeys.me).toEqual(["auth", "me"]);
        });
    });

    describe("profileOptions", () => {
        test("should have correct queryKey", () => {
            const options = profileOptions();
            expect([...options.queryKey]).toEqual(["auth", "me"]);
        });

        test("should be disabled when not authenticated", () => {
            const options = profileOptions();
            expect(options.enabled).toBe(false);
        });

        test("should be enabled when authenticated", () => {
            useAuthStore.getState().login("token", {
                id: 1,
                name: "Test",
                telegramId: "123",
                type: "user",
            });

            const options = profileOptions();
            expect(options.enabled).toBe(true);
        });
    });
});
