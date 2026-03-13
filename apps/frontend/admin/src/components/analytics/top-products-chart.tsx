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
import { Card, CardContent, CardHeader, CardTitle } from "@jahonbozor/ui";
import { motion } from "motion/react";
import type { TopProductData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";

const COLORS = ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"];

interface TopProductsChartProps {
	data: TopProductData[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
	const { t } = useTranslation();

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.4, delay: 0.2 }}
		>
			<Card>
				<CardHeader>
					<CardTitle>{t("top_products")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={data}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis dataKey="productName" tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<Tooltip
								formatter={(value: number, name: string) => [
									value,
									name === "quantitySold" ? t("quantity_sold") : name,
								]}
							/>
							<Legend />
							<Bar
								dataKey="quantitySold"
								fill="#3b82f6"
								name={t("quantity_sold")}
								radius={[4, 4, 0, 0]}
							>
								{data.map((_, index) => (
									<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</motion.div>
	);
}
