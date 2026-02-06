import z from "zod";

export const SignInBody = z.object({
    username: z.string().min(3).max(255),
    password: z.string().min(8).max(255),
});

export type SignInBody = z.infer<typeof SignInBody>;
