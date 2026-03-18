/**
 * Throw an Eden Treaty error as a proper Error instance.
 * Eden errors may not always be Error instances.
 */
function throwEdenError(error: unknown): never {
    throw error instanceof Error ? error : new Error(String(error));
}

/**
 * Unwrap a standard Eden response with `{ success, data }` pattern.
 * Throws on error or unsuccessful response.
 */
export function unwrap<T>(response: { data: unknown; error: unknown }): T {
    if (response.error) throwEdenError(response.error);
    const body = response.data as { success: boolean; data: T } | null;
    if (!body?.success) throw new Error("Request failed");
    return body.data;
}

/**
 * Check for Eden error and return raw response data.
 * Use for endpoints where the response body doesn't follow `{ success, data }` pattern.
 */
export function unwrapRaw<T = unknown>(response: { data: unknown; error: unknown }): T {
    if (response.error) throwEdenError(response.error);
    return response.data as T;
}
