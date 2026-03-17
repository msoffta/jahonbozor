import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { useDataTableTranslations } from "../use-data-table-translations";

describe("useDataTableTranslations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("should return all common translation keys", () => {
		const { result } = renderHook(() => useDataTableTranslations());

		expect(result.current.search).toBe("search");
		expect(result.current.columns).toBe("table_columns");
		expect(result.current.rowsPerPage).toBe("per_page");
		expect(result.current.showAll).toBe("table_show_all");
		expect(result.current.previous).toBe("table_previous");
		expect(result.current.next).toBe("table_next");
		expect(result.current.filterAll).toBe("filter_all");
		expect(result.current.filterMin).toBe("filter_min");
		expect(result.current.filterMax).toBe("filter_max");
		expect(result.current.filter).toBe("filter");
	});

	test("should set noResults when key is provided", () => {
		const { result } = renderHook(() =>
			useDataTableTranslations("orders_empty"),
		);

		expect(result.current.noResults).toBe("orders_empty");
	});

	test("should leave noResults undefined when no key provided", () => {
		const { result } = renderHook(() => useDataTableTranslations());

		expect(result.current.noResults).toBeUndefined();
	});

	test("should return an object with correct shape", () => {
		const { result } = renderHook(() =>
			useDataTableTranslations("no_data"),
		);

		const keys = Object.keys(result.current);
		expect(keys).toContain("search");
		expect(keys).toContain("noResults");
		expect(keys).toContain("columns");
		expect(keys).toContain("rowsPerPage");
		expect(keys).toContain("showAll");
		expect(keys).toContain("previous");
		expect(keys).toContain("next");
		expect(keys).toContain("filterAll");
		expect(keys).toContain("filterMin");
		expect(keys).toContain("filterMax");
		expect(keys).toContain("filter");
	});
});
