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
import { Card, CardContent, CardHeader, CardTitle, motion } from "@jahonbozor/ui";
import type { DailySalesData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import "dayjs/locale/uz-latn";
import { useChartColors } from "@/lib/chart-colors";

interface SalesTrendChartProps {
	data: DailySalesData[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
	const { t, i18n } = useTranslation("analytics");
	const colors = useChartColors();
	const dayjsLocale = i18n.language === "ru" ? "ru" : "uz-latn";

	const formattedData = data.map((item) => ({
		...item,
		date: dayjs(item.date).locale(dayjsLocale).format("DD MMM"),
	}));

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t("sales_trend")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={formattedData}>
							<CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
								stroke={colors.chart1}
								name={t("total_sales")}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
							<Line
								type="monotone"
								dataKey="totalExpenses"
								stroke={colors.chart3}
								name={t("total_expenses")}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
							<Line
								type="monotone"
								dataKey="profit"
								stroke={colors.chart2}
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
