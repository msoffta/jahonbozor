import type { DataTableTranslations } from "@jahonbozor/ui";
import { useTranslation } from "react-i18next";

export function useDataTableTranslations(
	noResultsKey?: string,
): DataTableTranslations {
	const { t } = useTranslation("common");

	return {
		search: t("search"),
		noResults: noResultsKey ? t(noResultsKey) : undefined,
		columns: t("table_columns"),
		rowsPerPage: t("per_page"),
		showAll: t("table_show_all"),
		previous: t("table_previous"),
		next: t("table_next"),
		filterAll: t("filter_all"),
		filterMin: t("filter_min"),
		filterMax: t("filter_max"),
		filter: t("filter"),
	};
}
