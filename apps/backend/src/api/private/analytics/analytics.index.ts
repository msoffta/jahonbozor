import type { AnalyticsSummaryResponse } from "@jahonbozor/schemas/src/analytics";
import { AnalyticsPeriodQuery } from "@jahonbozor/schemas/src/analytics";
import { Permission } from "@jahonbozor/schemas";
import { authMiddleware } from "@backend/lib/middleware";
import { Elysia } from "elysia";
import { AnalyticsService } from "./analytics.service";

export const analytics = new Elysia({ prefix: "/analytics" })
	.use(authMiddleware)
	.get(
		"/summary",
		async ({ query, logger }): Promise<AnalyticsSummaryResponse> => {
			try {
				return await AnalyticsService.getAnalyticsSummary(query, logger);
			} catch (error) {
				logger.error(
					"Analytics: Unhandled error in GET /analytics/summary",
					{ error },
				);
				return { success: false, error };
			}
		},
		{
			permissions: [Permission.ANALYTICS_VIEW],
			query: AnalyticsPeriodQuery,
		},
	);
