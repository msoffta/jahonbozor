import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageTransition } from "@jahonbozor/ui";

function CategoriesPage() {
    const { t } = useTranslation();

    return (
        <PageTransition className="p-6">
            <h1 className="text-2xl font-bold">{t("categories")}</h1>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/categories/")({
    beforeLoad: async () => {
        // Categories page is not implemented yet, redirect to home
        throw redirect({ to: "/" });
    },
    component: CategoriesPage,
});
