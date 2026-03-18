import { queryOptions } from "@tanstack/react-query";

import { api } from "@/api/client";

import type { StaffProfileData } from "@jahonbozor/schemas";

export const authKeys = {
    all: ["auth"] as const,
    me: () => [...authKeys.all, "me"] as const,
};

export const meQueryOptions = () =>
    queryOptions({
        queryKey: authKeys.me(),
        queryFn: async (): Promise<StaffProfileData> => {
            const { data, error } = await api.api.public.auth.me.get();
            if (error) throw error;
            if (!data.success) throw new Error("Request failed");
            return data.data as StaffProfileData;
        },
        enabled: false,
    });
