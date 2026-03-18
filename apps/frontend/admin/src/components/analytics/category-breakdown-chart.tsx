import { useTranslation } from "react-i18next";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle, motion } from "@jahonbozor/ui";

import { useChartColors } from "@/lib/chart-colors";

import type { CategorySalesData } from "@jahonbozor/schemas/src/analytics";

interface CategoryBreakdownChartProps {
    data: CategorySalesData[];
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
    const { t, i18n } = useTranslation("analytics");
    const colors = useChartColors();

    const chartData = data.map((item) => ({
        name: item.categoryName,
        value: item.totalRevenue,
    }));

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
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
                                label={({ name, percent }) =>
                                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                            >
                                {chartData.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={colors.palette[index % colors.palette.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) =>
                                    new Intl.NumberFormat(
                                        i18n.language === "ru" ? "ru-RU" : "uz-UZ",
                                        {
                                            style: "currency",
                                            currency: "UZS",
                                            maximumFractionDigits: 0,
                                        },
                                    ).format(Number(value ?? 0))
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
