import { describe, test, expect, beforeEach } from "bun:test";
import { useUIStore } from "@/stores/ui.store";

describe("i18n", () => {
    beforeEach(() => {
        useUIStore.setState({ locale: "uz" });
    });

    test("should initialize with locale from UI store", async () => {
        const i18n = (await import("@/lib/i18n")).default;

        expect(i18n.language).toBe("uz");
    });

    test("should have uz as fallback language", async () => {
        const i18n = (await import("@/lib/i18n")).default;

        expect(i18n.options.fallbackLng).toEqual(["uz"]);
    });

    test("should use common as default namespace", async () => {
        const i18n = (await import("@/lib/i18n")).default;

        expect(i18n.options.defaultNS).toBe("common");
    });

    test("should sync language when UI store locale changes", async () => {
        const i18n = (await import("@/lib/i18n")).default;

        useUIStore.getState().setLocale("ru");

        // Zustand subscriptions are synchronous
        expect(i18n.language).toBe("ru");
    });

    test("should have both uz and ru resources loaded", async () => {
        const i18n = (await import("@/lib/i18n")).default;

        expect(i18n.hasResourceBundle("uz", "common")).toBe(true);
        expect(i18n.hasResourceBundle("ru", "common")).toBe(true);
    });
});
