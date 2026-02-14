import {
    type Permission,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
} from "@jahonbozor/schemas";
import { useAuthStore } from "@/stores/auth.store";

export function useHasPermission(required: Permission): boolean {
    const permissions = useAuthStore(
        (state) => state.user?.permissions ?? [],
    );
    return hasPermission(permissions, required);
}

export function useHasAnyPermission(required: Permission[]): boolean {
    const permissions = useAuthStore(
        (state) => state.user?.permissions ?? [],
    );
    return hasAnyPermission(permissions, required);
}

export function useHasAllPermissions(required: Permission[]): boolean {
    const permissions = useAuthStore(
        (state) => state.user?.permissions ?? [],
    );
    return hasAllPermissions(permissions, required);
}
