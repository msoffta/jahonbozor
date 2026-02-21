import z from "zod";

export const SignInBody = z.object({
    username: z.string().min(3).max(255),
    password: z.string().min(8).max(255),
});

export type SignInBody = z.infer<typeof SignInBody>;

// --- Response types ---

import type { ReturnSchema } from "../common/base.model";

export interface LoginData {
    staff: { id: number; fullname: string; username: string; roleId: number; type: string };
    token: string;
}

export type LoginResponse = ReturnSchema<LoginData>;
export type RefreshResponse = ReturnSchema<{ token: string }>;
export type LogoutResponse = ReturnSchema<null>;

export interface StaffProfileData {
    id: number;
    fullname: string;
    username: string;
    telegramId: unknown;
    roleId: number;
    role: { id: number; name: string; permissions: string[] };
    createdAt: string;
    updatedAt: string;
    type: string;
}

export interface UserProfileData {
    id: number;
    fullname: string;
    username: string;
    phone: string;
    telegramId: unknown;
    photo: string | null;
    language: string;
    createdAt: string;
    updatedAt: string;
    type: string;
}

export type ProfileResponse = ReturnSchema<(StaffProfileData | UserProfileData) & { type: string }>;
