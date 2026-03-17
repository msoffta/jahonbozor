import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";

import { hasAnyPermission, Permission } from "@jahonbozor/schemas";
import { PageTransition, Tabs, TabsContent, TabsList, TabsTrigger } from "@jahonbozor/ui";

import { RolesTab } from "@/components/settings/roles-tab";
import { StaffTab } from "@/components/settings/staff-tab";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

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
                <div className="text-muted-foreground text-center">{t("no_permissions")}</div>
            </PageTransition>
        );
    }

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-6">
            <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

            <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="bg-muted/50 mb-6 inline-grid h-auto w-full grid-cols-2 rounded-lg p-1 sm:w-auto sm:max-w-100">
                    {hasStaffPermission && (
                        <TabsTrigger
                            value="staff"
                            className="data-[state=active]:bg-background flex items-center justify-center gap-2 rounded-md py-2.5 font-medium transition-all data-[state=active]:shadow-sm"
                        >
                            <Users className="h-4 w-4" />
                            {t("tab_staff")}
                        </TabsTrigger>
                    )}
                    {hasRolesPermission && (
                        <TabsTrigger
                            value="roles"
                            className="data-[state=active]:bg-background flex items-center justify-center gap-2 rounded-md py-2.5 font-medium transition-all data-[state=active]:shadow-sm"
                        >
                            <ShieldCheck className="h-4 w-4" />
                            {t("tab_roles")}
                        </TabsTrigger>
                    )}
                </TabsList>

                {hasStaffPermission && (
                    <TabsContent
                        value="staff"
                        className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border p-4 shadow-sm"
                    >
                        <StaffTab />
                    </TabsContent>
                )}

                {hasRolesPermission && (
                    <TabsContent
                        value="roles"
                        className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border p-4 shadow-sm"
                    >
                        <RolesTab />
                    </TabsContent>
                )}
            </Tabs>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/settings")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        const canAccessSettings = hasAnyPermission(permissions, [
            Permission.STAFF_LIST,
            Permission.ROLES_LIST,
        ]);
        if (!canAccessSettings) {
            throw redirect({ to: "/" });
        }
    },
    component: SettingsPage,
});
