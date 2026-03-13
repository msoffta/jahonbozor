import { api } from "@/api/client";
import type { AnalyticsSummaryData } from "@jahonbozor/schemas/src/analytics";
import { queryOptions } from "@tanstack/react-query";

export const analyticsKeys = {
	all: ["analytics"] as const,
	summary: (params?: { dateFrom?: string; dateTo?: string }) =>
		[...analyticsKeys.all, "summary", params] as const,
};

export const analyticsSummaryQueryOptions = (params?: {
	dateFrom?: string;
	dateTo?: string;
}) =>
	queryOptions({
		queryKey: analyticsKeys.summary(params),
		queryFn: async (): Promise<AnalyticsSummaryData> => {
			const { data, error } = await api.api.private.analytics.summary.get({
				query: params || {},
			});
			if (error) throw error;
			if (!data.success) throw new Error("Request failed");
			return data.data as AnalyticsSummaryData;
		},
	});
