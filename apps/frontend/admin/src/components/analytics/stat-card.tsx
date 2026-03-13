import { Card, CardContent, CardHeader, CardTitle } from "@jahonbozor/ui";
import { motion } from "motion/react";
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
	iconColor = "text-blue-500",
	trend,
}: StatCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
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
								trend.isPositive ? "text-green-600" : "text-red-600"
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
