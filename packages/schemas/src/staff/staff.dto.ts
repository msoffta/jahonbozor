import z from "zod";
import { PaginationQuery } from "../common/pagination.model";
import { Staff } from "./staff.model";

export const CreateStaffBody = Staff.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    passwordHash: true,
    role: true,
}).extend({
    password: z.string().min(6),
});

export const UpdateStaffBody = CreateStaffBody.partial();

export const StaffPagination = PaginationQuery.extend({
    roleId: z.coerce.number().optional(),
    searchQuery: z.string().optional(),
});

export type CreateStaffBody = z.infer<typeof CreateStaffBody>;
export type UpdateStaffBody = z.infer<typeof UpdateStaffBody>;
export type StaffPagination = z.infer<typeof StaffPagination>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface StaffItem {
    id: number;
    fullname: string;
    username: string;
    telegramId: unknown;
    roleId: number;
    role: { id: number; name: string; permissions: string[] };
    createdAt: string;
    updatedAt: string;
}

export type StaffListResponse = ReturnSchema<{ count: number; staff: StaffItem[] }>;
export type StaffDetailResponse = ReturnSchema<StaffItem>;
export type StaffDeleteResponse = ReturnSchema<{ id: number; fullname: string; username: string }>;
