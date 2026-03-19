import { useTranslation } from "react-i18next";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, motion } from "@jahonbozor/ui";

import { useChartColors } from "@/lib/chart-colors";

import type { TopProductData } from "@jahonbozor/schemas/src/analytics";

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
                        <BarChart data={data} barCategoryGap="20%">
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={colors.grid}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="productName"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                            <Tooltip
                                formatter={(value) => [
                                    Number(value ?? 0).toLocaleString(),
                                    t("quantity_sold"),
                                ]}
                                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                            />
                            <Bar
                                dataKey="quantitySold"
                                name={t("quantity_sold")}
                                radius={[6, 6, 0, 0]}
                            >
                                {data.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={colors.palette[index % colors.palette.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </motion.div>
    );
}
