import { Role } from "./roles.model";

import type z from "zod";

export const CreateRoleBody = Role.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateRoleBody = CreateRoleBody.partial();

export type CreateRoleBody = z.infer<typeof CreateRoleBody>;
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface RoleItem {
    id: number;
    name: string;
    permissions: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
}

export type RolesListResponse = ReturnSchema<{ count: number; roles: RoleItem[] }>;
export type RoleDetailResponse = ReturnSchema<RoleItem>;
