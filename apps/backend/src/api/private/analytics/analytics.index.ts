import { Elysia } from "elysia";

import { Permission } from "@jahonbozor/schemas";
import { AnalyticsPeriodQuery } from "@jahonbozor/schemas/src/analytics";

import { authMiddleware } from "@backend/lib/middleware";

import { AnalyticsService } from "./analytics.service";

import type { AnalyticsSummaryResponse } from "@jahonbozor/schemas/src/analytics";

export const analytics = new Elysia({ prefix: "/analytics" }).use(authMiddleware).get(
    "/summary",
    async ({ query, set, logger }): Promise<AnalyticsSummaryResponse> => {
        try {
            return await AnalyticsService.getAnalyticsSummary(query, logger);
        } catch (error) {
            logger.error("Analytics: Unhandled error in GET /analytics/summary", { error });
            set.status = 500;
            return { success: false, error: "Internal Server Error" };
        }
    },
    {
        permissions: [Permission.ANALYTICS_VIEW],
        query: AnalyticsPeriodQuery,
    },
);
