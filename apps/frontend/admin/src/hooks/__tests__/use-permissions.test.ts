import { describe, test, expect, beforeEach } from "bun:test";
import { renderHook } from "@testing-library/react";
import { Permission } from "@jahonbozor/schemas";
import { useAuthStore } from "../../stores/auth.store";
import {
    useHasPermission,
    useHasAnyPermission,
    useHasAllPermissions,
} from "../use-permissions";

const staffPermissions: Permission[] = [
    Permission.PRODUCTS_LIST,
    Permission.PRODUCTS_CREATE,
    Permission.PRODUCTS_READ,
    Permission.ORDERS_LIST_ALL,
];

describe("useHasPermission", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    test("should return true when user has the permission", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() => useHasPermission(Permission.PRODUCTS_LIST));
        expect(result.current).toBe(true);
    });

    test("should return false when user lacks the permission", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() => useHasPermission(Permission.STAFF_DELETE));
        expect(result.current).toBe(false);
    });

    test("should return false when permissions are empty", () => {
        useAuthStore.setState({ permissions: [] });
        const { result } = renderHook(() => useHasPermission(Permission.PRODUCTS_LIST));
        expect(result.current).toBe(false);
    });
});

describe("useHasAnyPermission", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    test("should return true when user has at least one permission", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() =>
            useHasAnyPermission([Permission.STAFF_DELETE, Permission.PRODUCTS_LIST]),
        );
        expect(result.current).toBe(true);
    });

    test("should return false when user has none of the permissions", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() =>
            useHasAnyPermission([Permission.STAFF_DELETE, Permission.ROLES_CREATE]),
        );
        expect(result.current).toBe(false);
    });

    test("should return false with empty user permissions", () => {
        useAuthStore.setState({ permissions: [] });
        const { result } = renderHook(() =>
            useHasAnyPermission([Permission.PRODUCTS_LIST]),
        );
        expect(result.current).toBe(false);
    });

    test("should return false with empty required permissions", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() => useHasAnyPermission([]));
        expect(result.current).toBe(false);
    });
});

describe("useHasAllPermissions", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            user: null,
            permissions: [],
            isAuthenticated: false,
        });
    });

    test("should return true when user has all permissions", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() =>
            useHasAllPermissions([Permission.PRODUCTS_LIST, Permission.PRODUCTS_CREATE]),
        );
        expect(result.current).toBe(true);
    });

    test("should return false when user is missing one permission", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() =>
            useHasAllPermissions([Permission.PRODUCTS_LIST, Permission.STAFF_DELETE]),
        );
        expect(result.current).toBe(false);
    });

    test("should return false with empty user permissions", () => {
        useAuthStore.setState({ permissions: [] });
        const { result } = renderHook(() =>
            useHasAllPermissions([Permission.PRODUCTS_LIST]),
        );
        expect(result.current).toBe(false);
    });

    test("should return true with empty required permissions", () => {
        useAuthStore.setState({ permissions: staffPermissions });
        const { result } = renderHook(() => useHasAllPermissions([]));
        expect(result.current).toBe(true);
    });
});
