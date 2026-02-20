import { describe, test, expect, beforeEach } from "bun:test";
import { useUIStore } from "../ui.store";

describe("UI Store", () => {
    beforeEach(() => {
        useUIStore.setState({ locale: "uz" });
    });

    describe("setLocale", () => {
        test("should set locale to ru", () => {
            useUIStore.getState().setLocale("ru");
            expect(useUIStore.getState().locale).toBe("ru");
        });

        test("should set locale to uz", () => {
            useUIStore.getState().setLocale("ru");
            useUIStore.getState().setLocale("uz");
            expect(useUIStore.getState().locale).toBe("uz");
        });
    });

    describe("default state", () => {
        test("should have uz as default locale", () => {
            expect(useUIStore.getState().locale).toBe("uz");
        });
    });
});
