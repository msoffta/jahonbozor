import { describe, test, expect, beforeEach } from "bun:test";
import { useAuthStore } from "../auth.store";

describe("Auth Store", () => {
    beforeEach(() => {
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
    });

    describe("login", () => {
        test("should set token, user, and isAuthenticated", () => {
            const user = { id: 1, name: "Test", telegramId: "123", type: "user" as const };
            useAuthStore.getState().login("jwt-token", user);

            const state = useAuthStore.getState();
            expect(state.token).toBe("jwt-token");
            expect(state.user).toEqual(user);
            expect(state.isAuthenticated).toBe(true);
        });
    });

    describe("logout", () => {
        test("should clear all auth state", () => {
            const user = { id: 1, name: "Test", telegramId: "123", type: "user" as const };
            useAuthStore.getState().login("jwt-token", user);
            useAuthStore.getState().logout();

            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.user).toBeNull();
            expect(state.isAuthenticated).toBe(false);
        });
    });

    describe("setToken", () => {
        test("should update token only", () => {
            useAuthStore.getState().setToken("new-token");

            expect(useAuthStore.getState().token).toBe("new-token");
            expect(useAuthStore.getState().user).toBeNull();
        });
    });

    describe("setUser", () => {
        test("should update user only", () => {
            const user = { id: 1, name: "Test", telegramId: "123", type: "user" as const };
            useAuthStore.getState().setUser(user);

            expect(useAuthStore.getState().user).toEqual(user);
            expect(useAuthStore.getState().token).toBeNull();
        });
    });
});
