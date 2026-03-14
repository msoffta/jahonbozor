import { PageTransition, Tabs, TabsList, TabsTrigger, TabsContent } from "@jahonbozor/ui";
import { useHasPermission } from "@/hooks/use-permissions";
import { Permission } from "@jahonbozor/schemas";
import { StaffTab } from "@/components/settings/staff-tab";
import { RolesTab } from "@/components/settings/roles-tab";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { Users, ShieldCheck } from "lucide-react";

function SettingsPage() {
	const { t } = useTranslation("settings");
	const hasStaffPermission = useHasPermission(Permission.STAFF_LIST);
	const hasRolesPermission = useHasPermission(Permission.ROLES_LIST);

	const defaultTab = useMemo(() => {
		if (hasStaffPermission) return "staff";
		if (hasRolesPermission) return "roles";
		return null;
	}, [hasStaffPermission, hasRolesPermission]);

	if (!defaultTab) {
		return (
			<PageTransition className="p-6">
				<div className="text-center text-muted-foreground">{t("no_permissions")}</div>
			</PageTransition>
		);
	}

	return (
		<PageTransition className="p-6 flex-1 flex flex-col min-h-0">
			<h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

			<Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
				<TabsList className="mb-6 w-full sm:w-auto inline-grid grid-cols-2 h-auto p-1 bg-muted/50 rounded-lg sm:max-w-100">
					{hasStaffPermission && (
						<TabsTrigger 
							value="staff" 
							className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all font-medium"
						>
							<Users className="h-4 w-4" />
							{t("tab_staff")}
						</TabsTrigger>
					)}
					{hasRolesPermission && (
						<TabsTrigger 
							value="roles" 
							className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all font-medium"
						>
							<ShieldCheck className="h-4 w-4" />
							{t("tab_roles")}
						</TabsTrigger>
					)}
				</TabsList>

				{hasStaffPermission && (
					<TabsContent value="staff" className="flex-1 flex flex-col min-h-0 border rounded-xl bg-card text-card-foreground shadow-sm p-4 overflow-hidden">
						<StaffTab />
					</TabsContent>
				)}

				{hasRolesPermission && (
					<TabsContent value="roles" className="flex-1 flex flex-col min-h-0 border rounded-xl bg-card text-card-foreground shadow-sm p-4 overflow-hidden">
						<RolesTab />
					</TabsContent>
				)}
			</Tabs>
		</PageTransition>
	);
}

export const Route = createFileRoute("/_dashboard/settings")({
	component: SettingsPage,
});
