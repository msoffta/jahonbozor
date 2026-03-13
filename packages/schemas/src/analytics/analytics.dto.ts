import z from "zod";
import { ReturnSchema } from "../common/base.model";

// Query schema
export const AnalyticsPeriodQuery = z.object({
	dateFrom: z.iso.datetime().optional(),
	dateTo: z.iso.datetime().optional(),
});

export type AnalyticsPeriodQuery = z.infer<typeof AnalyticsPeriodQuery>;

// Response types
export interface DailySalesData {
	date: string;
	totalSales: number;
	totalOrders: number;
	totalExpenses: number;
	profit: number;
}

export interface TopProductData {
	productId: number;
	productName: string;
	quantitySold: number;
	totalRevenue: number;
}

export interface CategorySalesData {
	categoryId: number;
	categoryName: string;
	totalRevenue: number;
	orderCount: number;
}

export interface AnalyticsSummaryData {
	period: {
		from: string;
		to: string;
	};
	overview: {
		totalSales: number;
		totalExpenses: number;
		profit: number;
		ordersCount: number;
		acceptedOrdersCount: number;
	};
	dailySales: DailySalesData[];
	topProducts: TopProductData[];
	categoryBreakdown: CategorySalesData[];
}

export type AnalyticsSummaryResponse = ReturnSchema<AnalyticsSummaryData>;
