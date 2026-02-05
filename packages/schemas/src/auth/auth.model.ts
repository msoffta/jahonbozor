import z from "zod";
import { TokenStaff } from "../staff/staff.model";
import { TokenUser } from "../users/users.model";

export const Token = z.discriminatedUnion("type", [TokenStaff, TokenUser]);
export type Token = z.infer<typeof Token>;
