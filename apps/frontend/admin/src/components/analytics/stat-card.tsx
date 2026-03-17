import { Card, CardContent, CardHeader, CardTitle, motion } from "@jahonbozor/ui";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    iconColor?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function StatCard({
    title,
    value,
    icon: Icon,
    iconColor = "text-muted-foreground",
    trend,
}: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{value}</div>
                    {trend && (
                        <p
                            className={`text-xs ${
                                trend.isPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                            }`}
                        >
                            {trend.isPositive ? "+" : ""}
                            {trend.value}%
                        </p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
