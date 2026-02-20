import { describe, test, expect, mock, beforeEach } from "bun:test";
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

let mockQueryData: { count: number; products: ReturnType<typeof makeProducts> } | undefined;
let mockIsLoading = false;

mock.module("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@tanstack/react-router", () => ({
    Link: ({ children, to, search, ...props }: any) => (
        <a href={`${to}?categoryId=${search?.categoryId || ""}`} {...props}>
            {children}
        </a>
    ),
}));

mock.module("@tanstack/react-query", () => ({
    useQuery: () => ({
        data: mockQueryData,
        isLoading: mockIsLoading,
    }),
}));

mock.module("@jahonbozor/ui", () => ({
    Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
}));

mock.module("@/api/products.api", () => ({
    productsListOptions: () => ({}),
}));

import { CategorySection } from "../category-section";

describe("CategorySection", () => {
    beforeEach(() => {
        useCartStore.setState({ items: [] });
        mockQueryData = undefined;
        mockIsLoading = false;
    });

    test("should return null when no products and not loading", () => {
        mockQueryData = { count: 0, products: [] };
        const { container } = render(
            <CategorySection categoryId={1} categoryName="Empty" />,
        );
        expect(container.innerHTML).toBe("");
    });

    test("should render category name", () => {
        mockQueryData = { count: 3, products: makeProducts(3) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Electronics" />,
        );
        expect(getByText("Electronics")).toBeDefined();
    });

    test("should render product cards", () => {
        mockQueryData = { count: 3, products: makeProducts(3) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getByText("Product 1")).toBeDefined();
        expect(getByText("Product 2")).toBeDefined();
        expect(getByText("Product 3")).toBeDefined();
    });

    test("should show loading skeletons", () => {
        mockIsLoading = true;
        const { getAllByTestId } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getAllByTestId("skeleton").length).toBeGreaterThan(0);
    });

    test("should not show 'see all' when count <= 10", () => {
        mockQueryData = { count: 5, products: makeProducts(5) };
        const { queryByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(queryByText(/see_all/)).toBeNull();
    });

    test("should show 'see all' when count > 10", () => {
        mockQueryData = { count: 15, products: makeProducts(10) };
        const { getByText } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        expect(getByText(/see_all/)).toBeDefined();
    });

    test("should render products in vertical list", () => {
        mockQueryData = { count: 3, products: makeProducts(3) };
        const { container } = render(
            <CategorySection categoryId={1} categoryName="Cat" />,
        );
        const productList = container.querySelector("[class*='flex-col'][class*='gap-1.5']");
        expect(productList).toBeDefined();
        expect(container.querySelector("[class*='overflow-x']")).toBeNull();
    });

    test("should link category name to products page with categoryId", () => {
        mockQueryData = { count: 2, products: makeProducts(2) };
        const { getByText } = render(
            <CategorySection categoryId={7} categoryName="Food" />,
        );
        const link = getByText("Food").closest("a");
        expect(link?.getAttribute("href")).toContain("categoryId=7");
    });
});
