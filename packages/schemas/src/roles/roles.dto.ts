import z from "zod";
import { Role } from "./roles.model";

export const CreateRoleBody = Role.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateRoleBody = CreateRoleBody.partial();

export type CreateRoleBody = z.infer<typeof CreateRoleBody>;
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;
