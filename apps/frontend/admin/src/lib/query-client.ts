import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,
            gcTime: 1000 * 60 * 60, // 1h — keep cache manageable for localStorage persistence
            refetchInterval: 1000 * 60,
            retry: 1,
            refetchOnWindowFocus: true,
        },
        mutations: {
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
    },
});
