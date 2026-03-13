import {
	PieChart,
	Pie,
	Cell,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@jahonbozor/ui";
import { motion } from "motion/react";
import type { CategorySalesData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

interface CategoryBreakdownChartProps {
	data: CategorySalesData[];
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
	const { t, i18n } = useTranslation();

	const chartData = data.map((item) => ({
		name: item.categoryName,
		value: item.totalRevenue,
	}));

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.4, delay: 0.3 }}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t("category_breakdown")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="50%"
								outerRadius={100}
								label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
							>
								{chartData.map((_, index) => (
									<Cell
										key={`cell-${index}`}
										fill={COLORS[index % COLORS.length]}
									/>
								))}
							</Pie>
							<Tooltip
								formatter={(value: number) =>
									new Intl.NumberFormat(i18n.language === "ru" ? "ru-RU" : "uz-UZ", {
										style: "currency",
										currency: "UZS",
										maximumFractionDigits: 0,
									}).format(value)
								}
							/>
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</motion.div>
	);
}
