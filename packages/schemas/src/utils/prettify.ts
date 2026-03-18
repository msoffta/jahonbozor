import z from "zod";

import type { ZodError } from "zod";

export const prettifyError = <T>(error: ZodError<T>) => {
    return z.prettifyError(error);
};
