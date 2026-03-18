import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockMutate, mocks } = vi.hoisted(() => ({
    mockMutate: vi.fn(),
    mocks: {
        isPending: false,
        isError: false,
    },
}));

vi.mock("@/lib/api-client", () => ({
    api: {
        api: {
            public: {
                auth: { me: { get: vi.fn() }, logout: { post: vi.fn() } },
                users: { telegram: { post: vi.fn() }, language: { put: vi.fn() } },
            },
        },
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params) return `${key}_${JSON.stringify(params)}`;
            return key;
        },
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (config: any) => config,
    lazyRouteComponent: (component: any) => component,
    redirect: () => ({}),
    useNavigate: () => vi.fn(),
}));

vi.mock("@sentry/react", () => ({
    setUser: vi.fn(),
    captureException: vi.fn(),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

vi.mock("@/api/auth.api", () => ({
    authKeys: { me: ["auth", "me"] },
    profileOptions: () => ({ queryKey: ["auth", "me"] }),
}));

vi.mock("@/hooks/use-auth", () => ({
    useTelegramLogin: () => ({
        mutate: mockMutate,
        isPending: mocks.isPending,
        isError: mocks.isError,
    }),
    useLogout: () => ({ mutate: vi.fn() }),
    useUpdateLanguage: () => ({ mutate: vi.fn() }),
}));

import { render } from "@testing-library/react";

import { useUIStore } from "@/stores/ui.store";

import { Route } from "../login";

const LoginPage = (Route as any).component ?? (Route as any).options?.component;

describe("LoginPage", () => {
    beforeEach(() => {
        mocks.isPending = false;
        mocks.isError = false;
        useUIStore.setState({ locale: "uz" });
    });

    test("should render logo", () => {
        const { container } = render(<LoginPage />);
        const logo = container.querySelector("img[alt='Jahon Bozor']");
        expect(logo).toBeDefined();
        expect(logo).not.toBeNull();
    });

    test("should render language buttons", () => {
        const { getByText } = render(<LoginPage />);
        expect(getByText("uzbek")).toBeDefined();
        expect(getByText("russian")).toBeDefined();
    });

    test("should render Telegram widget area", () => {
        const { container } = render(<LoginPage />);
        const widgetArea = container.querySelector("div.flex.justify-center");
        expect(widgetArea).toBeDefined();
        expect(widgetArea).not.toBeNull();
    });

    test("should show loading text when pending", () => {
        mocks.isPending = true;

        const { getByText } = render(<LoginPage />);
        expect(getByText("loading")).toBeDefined();
    });

    test("should show error text when error", () => {
        mocks.isError = true;

        const { getByText } = render(<LoginPage />);
        expect(getByText("error")).toBeDefined();
    });

    test("should show bot not configured message when env var empty", () => {
        const { getByText } = render(<LoginPage />);
        expect(getByText("bot_username_not_configured")).toBeDefined();
    });

    test("should render inside PageTransition", () => {
        const { getByTestId } = render(<LoginPage />);
        expect(getByTestId("page-transition")).toBeDefined();
    });
});
