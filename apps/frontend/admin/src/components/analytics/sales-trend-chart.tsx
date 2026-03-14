import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@jahonbozor/ui";
import { motion } from "motion/react";
import type { DailySalesData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru, uz } from "date-fns/locale";

interface SalesTrendChartProps {
	data: DailySalesData[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
	const { t, i18n } = useTranslation();
	const locale = i18n.language === "ru" ? ru : uz;

	const formattedData = data.map((item) => ({
		...item,
		date: format(new Date(item.date), "dd MMM", { locale }),
	}));

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.4, delay: 0.1 }}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t("sales_trend")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={formattedData}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis dataKey="date" tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<Tooltip
								labelFormatter={(label) => {
									return label;
								}}
								formatter={(value, name) => [
									new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : "uz-UZ", {
										style: "currency",
										currency: "UZS",
										maximumFractionDigits: 0,
									}).format(Number(value ?? 0)),
									String(name ?? ""),
								]}
							/>
							<Legend />
							<Line
								type="monotone"
								dataKey="totalSales"
								stroke="#3b82f6"
								name={t("total_sales")}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
							<Line
								type="monotone"
								dataKey="totalExpenses"
								stroke="#ef4444"
								name={t("total_expenses")}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
							<Line
								type="monotone"
								dataKey="profit"
								stroke="#10b981"
								name={t("profit")}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
						</LineChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</motion.div>
	);
}
