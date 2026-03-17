import { describe, test, expect, beforeEach } from "vitest";
import { useAuthStore } from "../auth.store";
import type { TokenStaff } from "@jahonbozor/schemas/src/staff/staff.model";
import { Permission } from "@jahonbozor/schemas";

const mockStaff: TokenStaff = {
    id: 1,
    fullname: "Test User",
    username: "testuser",
    roleId: 1,
    type: "staff",
};

const mockPermissions: Permission[] = [
    Permission.PRODUCTS_LIST,
    Permission.PRODUCTS_CREATE,
    Permission.ORDERS_LIST_ALL,
];

describe("Auth Store", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    describe("initial state", () => {
        test("should have null token", () => {
            expect(useAuthStore.getState().token).toBeNull();
        });

        test("should have null user", () => {
            expect(useAuthStore.getState().user).toBeNull();
        });

        test("should have empty permissions", () => {
            expect(useAuthStore.getState().permissions).toEqual([]);
        });

        test("should not be authenticated", () => {
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });

    describe("setAuth", () => {
        test("should set token, user, permissions and isAuthenticated", () => {
            useAuthStore.getState().setAuth("jwt-token-123", mockStaff, mockPermissions);

            const state = useAuthStore.getState();
            expect(state.token).toBe("jwt-token-123");
            expect(state.user).toEqual(mockStaff);
            expect(state.permissions).toEqual(mockPermissions);
            expect(state.isAuthenticated).toBe(true);
        });

        test("should set auth with empty permissions array", () => {
            useAuthStore.getState().setAuth("token", mockStaff, []);

            const state = useAuthStore.getState();
            expect(state.token).toBe("token");
            expect(state.user).toEqual(mockStaff);
            expect(state.permissions).toEqual([]);
            expect(state.isAuthenticated).toBe(true);
        });

        test("should overwrite previous auth data", () => {
            useAuthStore.getState().setAuth("old-token", mockStaff, [Permission.PRODUCTS_LIST]);

            const newStaff: TokenStaff = { ...mockStaff, id: 2, fullname: "New User" };
            useAuthStore.getState().setAuth("new-token", newStaff, [Permission.ORDERS_LIST_ALL]);

            const state = useAuthStore.getState();
            expect(state.token).toBe("new-token");
            expect(state.user?.id).toBe(2);
            expect(state.user?.fullname).toBe("New User");
            expect(state.permissions).toEqual([Permission.ORDERS_LIST_ALL]);
        });
    });

    describe("clearAuth", () => {
        test("should reset all fields to defaults", () => {
            useAuthStore.getState().setAuth("token", mockStaff, mockPermissions);
            useAuthStore.getState().clearAuth();

            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.user).toBeNull();
            expect(state.permissions).toEqual([]);
            expect(state.isAuthenticated).toBe(false);
        });

        test("should be safe to call when already cleared", () => {
            useAuthStore.getState().clearAuth();

            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.isAuthenticated).toBe(false);
        });
    });
});
