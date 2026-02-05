import z from "zod";
import { Permission, ALL_PERMISSIONS } from "./permissions";
import { Resource } from "./resources";
import { Action } from "./actions";
import { Scope } from "./scopes";

// Schema for a single permission - validates only known permissions
export const PermissionSchema = z.enum(ALL_PERMISSIONS);

// Schema for an array of permissions
export const PermissionsArraySchema = z.array(PermissionSchema);

// Types - strictly typed as Permission, not string
export type PermissionSchemaType = z.infer<typeof PermissionSchema>;
export type PermissionsArraySchemaType = z.infer<typeof PermissionsArraySchema>;

/**
 * Check if user has a specific permission
 */
export const hasPermission = (
    userPermissions: Permission[],
    requiredPermission: Permission,
): boolean => {
    return userPermissions.includes(requiredPermission);
};

/**
 * Check if user has permission with scope consideration
 * Note: :all scope covers :own scope
 */
export const hasPermissionWithScope = (
    userPermissions: Permission[],
    resource: Resource,
    action: Action,
    scope?: Scope,
): boolean => {
    // Build the :all permission to check if it covers :own
    const allPermissionStr = `${resource}:${action}:all`;

    // Check if this matches any known permission
    if (
        ALL_PERMISSIONS.includes(allPermissionStr as Permission) &&
        userPermissions.includes(allPermissionStr as Permission)
    ) {
        return true;
    }

    // Check for exact permission
    const permissionStr = scope
        ? `${resource}:${action}:${scope}`
        : `${resource}:${action}`;

    return (
        ALL_PERMISSIONS.includes(permissionStr as Permission) &&
        userPermissions.includes(permissionStr as Permission)
    );
};

/**
 * Check if user has any of the required permissions
 */
export const hasAnyPermission = (
    userPermissions: Permission[],
    requiredPermissions: readonly Permission[],
): boolean => {
    return requiredPermissions.some((p) => userPermissions.includes(p));
};

/**
 * Check if user has all of the required permissions
 */
export const hasAllPermissions = (
    userPermissions: Permission[],
    requiredPermissions: readonly Permission[],
): boolean => {
    return requiredPermissions.every((p) => userPermissions.includes(p));
};

/**
 * Build permission string from components (returns Permission type if valid)
 */
export const buildPermission = (
    resource: Resource,
    action: Action,
    scope?: Scope,
): Permission | null => {
    const permissionStr = scope
        ? `${resource}:${action}:${scope}`
        : `${resource}:${action}`;

    if (ALL_PERMISSIONS.includes(permissionStr as Permission)) {
        return permissionStr as Permission;
    }
    return null;
};
