import { describe, test, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui.store";

describe("UI Store", () => {
    beforeEach(() => {
        useUIStore.setState({
            sidebarOpen: true,
            locale: "uz",
        });
    });

    describe("initial state", () => {
        test("should have sidebar open by default", () => {
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });

        test("should have uz locale by default", () => {
            expect(useUIStore.getState().locale).toBe("uz");
        });
    });

    describe("toggleSidebar", () => {
        test("should close sidebar when open", () => {
            useUIStore.getState().toggleSidebar();
            expect(useUIStore.getState().sidebarOpen).toBe(false);
        });

        test("should open sidebar when closed", () => {
            useUIStore.setState({ sidebarOpen: false });
            useUIStore.getState().toggleSidebar();
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });

        test("should toggle back and forth", () => {
            useUIStore.getState().toggleSidebar();
            expect(useUIStore.getState().sidebarOpen).toBe(false);
            useUIStore.getState().toggleSidebar();
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });
    });

    describe("setSidebarOpen", () => {
        test("should set sidebar to open", () => {
            useUIStore.setState({ sidebarOpen: false });
            useUIStore.getState().setSidebarOpen(true);
            expect(useUIStore.getState().sidebarOpen).toBe(true);
        });

        test("should set sidebar to closed", () => {
            useUIStore.getState().setSidebarOpen(false);
            expect(useUIStore.getState().sidebarOpen).toBe(false);
        });
    });

    describe("setLocale", () => {
        test("should set locale to ru", () => {
            useUIStore.getState().setLocale("ru");
            expect(useUIStore.getState().locale).toBe("ru");
        });

        test("should set locale to uz", () => {
            useUIStore.setState({ locale: "ru" });
            useUIStore.getState().setLocale("uz");
            expect(useUIStore.getState().locale).toBe("uz");
        });

        test("should switch between locales", () => {
            useUIStore.getState().setLocale("ru");
            expect(useUIStore.getState().locale).toBe("ru");
            useUIStore.getState().setLocale("uz");
            expect(useUIStore.getState().locale).toBe("uz");
        });
    });
});
