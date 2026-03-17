import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useCartStore } from "@/stores/cart.store";

const makeProducts = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: 1000 * (i + 1),
        categoryId: 1,
        remaining: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
    }));

const mocks = vi.hoisted(() => ({
    queryData: undefined as { count: number; products: any[] } | undefined,
    isLoading: false,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, search, ...props }: any) => (
        <a href={`${to}?categoryIds=${search?.categoryIds || ""}`} {...props}>
            {children}
        </a>
    ),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({
        data: mocks.queryData,
        isLoading: mocks.isLoading,
    }),
}));

vi.mock("motion/react", async () => {
    const { motionReactMock } = await import("@/test-utils/ui-mocks");
    return motionReactMock();
});
vi.mock("@jahonbozor/ui", async () => {
    const { jahonbozorUIMock } = await import("@/test-utils/ui-mocks");
    return jahonbozorUIMock();
});

vi.mock("@/api/products.api", () => ({
    productsListOptions: () => ({}),
}));

vi.mock("@/stores/ui.store", () => ({
    useUIStore: () => ({ locale: "uz" }),
}));

import { CategorySection } from "../category-section";

describe("CategorySection", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
        mocks.queryData = undefined;
        mocks.isLoading = false;
    });

    test("should return null when no products and not loading", () => {
        mocks.queryData = { count: 0, products: [] };
        const { container } = render(
            <CategorySection categoryId={1} categoryName="Empty" />,
        );
        expect(container.innerHTML).toBe("");
    });

    test("should render category name", () => {
        mocks.queryData = { count: 3, products: makeProducts(3) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Electronics" />,
        );
        expect(getByText("Electronics")).toBeDefined();
    });

    test("should render product cards", () => {
        mocks.queryData = { count: 3, products: makeProducts(3) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getByText("Product 1")).toBeDefined();
        expect(getByText("Product 2")).toBeDefined();
        expect(getByText("Product 3")).toBeDefined();
    });

    test("should show loading skeletons", () => {
        mocks.isLoading = true;
        const { getAllByTestId } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getAllByTestId("skeleton").length).toBeGreaterThan(0);
    });

    test("should not show 'see all' when count <= 10", () => {
        mocks.queryData = { count: 5, products: makeProducts(5) };
        const { queryByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(queryByText(/see_all/)).toBeNull();
    });

    test("should show 'see all' when count > 10", () => {
        mocks.queryData = { count: 15, products: makeProducts(10) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getByText(/see_all/)).toBeDefined();
    });

    test("should render products in vertical list", () => {
        mocks.queryData = { count: 3, products: makeProducts(3) };
        const { container } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        const productList = container.querySelector("[class*='flex-col'][class*='gap-1.5']");
        expect(productList).toBeDefined();
        expect(container.querySelector("[class*='overflow-x']")).toBeNull();
    });

    test("should link category name to products page with categoryId", () => {
        mocks.queryData = { count: 2, products: makeProducts(2) };
        const { getByText } = render(
            <CategorySection categoryId={7} categoryName="Food" />,
        );
        const link = getByText("Food").closest("a");
        expect(link?.getAttribute("href")).toContain("categoryIds=7");
    });
});
