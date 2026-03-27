import { useTranslation } from "react-i18next";

import type { DataTableTranslations } from "@jahonbozor/ui";

export function useDataTableTranslations(noResultsText?: string): DataTableTranslations {
    const { t } = useTranslation("common");

    return {
        search: t("search"),
        noResults: noResultsText,
        columns: t("table_columns"),
        rowsPerPage: t("per_page"),
        showAll: t("table_show_all"),
        previous: t("table_previous"),
        next: t("table_next"),
        filterAll: t("filter_all"),
        filterMin: t("filter_min"),
        filterMax: t("filter_max"),
        filter: t("filter"),
        showingOf: t("table_showing_of"),
        loadingMore: t("table_loading_more"),
        sumLabel: t("table_sum"),
    };
}
