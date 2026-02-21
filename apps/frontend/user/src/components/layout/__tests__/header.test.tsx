import { describe, test, expect, mock } from "bun:test";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

mock.module("@jahonbozor/ui", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
    motion: {
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
}));

import { Header } from "../header";

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("Header", () => {
    test("should render logo", () => {
        const { getByAltText } = render(<Header />, { wrapper: Wrapper });
        expect(getByAltText("Jahon Bozor")).toBeDefined();
    });

    test("should render notification button", () => {
        const { getAllByRole } = render(<Header />, { wrapper: Wrapper });
        const buttons = getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
});
