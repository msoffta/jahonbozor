import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, motion } from "@jahonbozor/ui";
import type { TopProductData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";
import { useChartColors } from "@/lib/chart-colors";

interface TopProductsChartProps {
	data: TopProductData[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
	const { t } = useTranslation("analytics");
	const colors = useChartColors();

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t("top_products")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={data}>
							<CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
							<XAxis dataKey="productName" tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<Tooltip
								formatter={(value, name) => [
									Number(value ?? 0),
									String(name) === "quantitySold" ? t("quantity_sold") : String(name ?? ""),
								]}
							/>
							<Legend />
							<Bar
								dataKey="quantitySold"
								fill={colors.chart1}
								name={t("quantity_sold")}
								radius={[4, 4, 0, 0]}
							>
								{data.map((_, index) => (
									<Cell key={`cell-${index}`} fill={colors.palette[index % colors.palette.length]} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</motion.div>
	);
}
