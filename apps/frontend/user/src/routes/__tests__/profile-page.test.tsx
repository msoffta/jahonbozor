import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockNavigate, mockLogoutMutate, mockUpdateLanguageMutate, mocks } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockLogoutMutate: vi.fn(),
    mockUpdateLanguageMutate: vi.fn(),
    mocks: {
        profileData: undefined as
            | {
                  fullname: string;
                  username?: string;
                  photo?: string | null;
                  createdAt?: string;
                  telegramId?: string | number;
              }
            | undefined,
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
    useNavigate: () => mockNavigate,
    useRouter: () => ({ history: { back: vi.fn() } }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({
        data: mocks.profileData,
        isLoading: false,
    }),
    useInfiniteQuery: () => ({
        data: undefined,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    queryOptions: (opts: any) => opts,
    infiniteQueryOptions: (opts: any) => opts,
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
    useTelegramLogin: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useLogout: () => ({
        mutate: mockLogoutMutate,
    }),
    useUpdateLanguage: () => ({
        mutate: mockUpdateLanguageMutate,
    }),
}));

vi.mock("@/lib/format", () => ({
    getLocaleCode: (locale: string) => (locale === "uz" ? "uz-UZ" : "ru-RU"),
    formatPrice: (price: number, locale: string) => price.toLocaleString(locale),
    formatDate: (date: string, locale: string) => new Date(date).toLocaleDateString(locale),
}));

import { fireEvent, render } from "@testing-library/react";

import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

import { Route } from "../_user/profile";

const ProfilePage = (Route as any).component ?? (Route as any).options?.component;

describe("ProfilePage", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: "test-token",
            user: {
                id: 1,
                name: "Test User",
                telegramId: "123456",
                phone: null,
                language: "uz",
                type: "user",
            },
            isAuthenticated: true,
        });

        useUIStore.setState({ locale: "uz" });

        mocks.profileData = {
            fullname: "Test User",
            username: "testuser",
            photo: null,
            createdAt: "2025-01-15T10:30:00.000Z",
            telegramId: "123456",
        };
    });

    test("should render user display name", () => {
        const { getByText } = render(<ProfilePage />);
        expect(getByText("Test User")).toBeDefined();
    });

    test("should render avatar with initials", () => {
        const { getByTestId } = render(<ProfilePage />);
        const avatar = getByTestId("avatar");
        expect(avatar).toBeDefined();
        const fallback = getByTestId("avatar-fallback");
        expect(fallback.textContent).toBe("TU");
    });

    test("should render orders button", () => {
        const { getByText } = render(<ProfilePage />);
        expect(getByText("orders")).toBeDefined();
    });

    test("should render cart button", () => {
        const { getByText } = render(<ProfilePage />);
        expect(getByText("cart")).toBeDefined();
    });

    test("should render change language button", () => {
        const { getByText } = render(<ProfilePage />);
        expect(getByText(/change_language/)).toBeDefined();
    });

    test("should render logout button", () => {
        const { getByText } = render(<ProfilePage />);
        expect(getByText("logout")).toBeDefined();
    });

    test("should navigate on button clicks", () => {
        const { getByText } = render(<ProfilePage />);

        const ordersButton = getByText("orders").closest("button");
        fireEvent.click(ordersButton!);
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/orders" });

        mockNavigate.mockClear();
        const cartButton = getByText("cart").closest("button");
        fireEvent.click(cartButton!);
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/cart" });
    });

    test("should render inside PageTransition", () => {
        const { getByTestId } = render(<ProfilePage />);
        expect(getByTestId("page-transition")).toBeDefined();
    });
});
