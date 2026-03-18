import { describe, expect, test } from "vitest";

import { formatDate, formatPrice, getLocaleCode } from "../format";

describe("getLocaleCode", () => {
    test("should return uz-UZ for uz locale", () => {
        expect(getLocaleCode("uz")).toBe("uz-UZ");
    });

    test("should return ru-RU for ru locale", () => {
        expect(getLocaleCode("ru")).toBe("ru-RU");
    });
});

describe("formatPrice", () => {
    test("should format price with space separators", () => {
        const result = formatPrice(50000, "ru-RU");
        expect(result).toMatch(/50\s*000/);
    });

    test("should handle zero price", () => {
        expect(formatPrice(0, "ru-RU")).toBe("0");
    });

    test("should handle small price without separators", () => {
        expect(formatPrice(999, "ru-RU")).toBe("999");
    });

    test("should handle large price", () => {
        const result = formatPrice(1000000, "ru-RU");
        expect(result).toMatch(/1\s*000\s*000/);
    });

    test("should work with uz-UZ locale", () => {
        const result = formatPrice(50000, "uz-UZ");
        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
    });
});

describe("formatDate", () => {
    test("should format date string", () => {
        const result = formatDate("2025-01-15T10:30:00.000Z", "ru-RU");
        expect(result).toContain("2025");
        expect(result).toContain("15");
    });

    test("should format Date object", () => {
        const result = formatDate(new Date("2025-06-20T14:00:00.000Z"), "ru-RU");
        expect(result).toContain("2025");
        expect(result).toContain("20");
    });

    test("should work with uz-UZ locale", () => {
        const result = formatDate("2025-01-15T10:30:00.000Z", "uz-UZ");
        expect(result).toBeDefined();
        expect(result).toContain("2025");
    });

    test("should include time in output", () => {
        const result = formatDate("2025-01-15T10:30:00.000Z", "ru-RU");
        expect(result.length).toBeGreaterThan(10);
    });
});
