import z from "zod";

export const SignInBody = z.object({
    username: z.string(),
    password: z.string(),
});

export type SignInBody = z.infer<typeof SignInBody>;
