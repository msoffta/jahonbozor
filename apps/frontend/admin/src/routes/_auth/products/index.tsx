import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function ProductsPage() {
    const { t } = useTranslation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">{t("products")}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_auth/products/")({
    component: ProductsPage,
});
