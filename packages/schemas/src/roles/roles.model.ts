import z from "zod";
import { BaseModel } from "../common/base.model";
import { PermissionsArraySchema } from "../permissions";

export const Role = BaseModel.extend({
    name: z.string().min(1).max(100),
    permissions: PermissionsArraySchema,
});

export type Role = z.infer<typeof Role>;
