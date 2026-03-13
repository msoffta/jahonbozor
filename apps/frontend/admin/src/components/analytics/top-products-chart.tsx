import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@jahonbozor/ui";
import { motion } from "motion/react";
import type { TopProductData } from "@jahonbozor/schemas/src/analytics";
import { useTranslation } from "react-i18next";

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
							<Tooltip />
							<Legend />
							<Bar
								dataKey="quantitySold"
								fill="#71717a"
								name={t("quantity_sold")}
							/>
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</motion.div>
	);
}
