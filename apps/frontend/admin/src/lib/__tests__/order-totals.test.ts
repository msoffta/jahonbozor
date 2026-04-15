import { describe, expect, test } from "vitest";

import { calcOrderCostprice, calcOrderTotal } from "../order-totals";

describe("calcOrderTotal", () => {
    test("returns sum of price * quantity for each item", () => {
        const items = [
            { price: 100, quantity: 2 },
            { price: 50, quantity: 3 },
        ];
        expect(calcOrderTotal(items)).toBe(350);
    });

    test("treats missing price/quantity as 0/1 respectively", () => {
        const items = [
            { price: null, quantity: 2 },
            { price: 100, quantity: null },
        ];
        expect(calcOrderTotal(items)).toBe(100);
    });

    test("returns 0 for empty array", () => {
        expect(calcOrderTotal([])).toBe(0);
    });

    test("memoizes result by array reference", () => {
        const items = [
            { price: 100, quantity: 1 },
            { price: 200, quantity: 2 },
        ];
        const first = calcOrderTotal(items);
        // Mutate values — cached result must stay (mutation is not expected
        // in production: items array identity changes when data reloads).
        items[0].price = 9999;
        const second = calcOrderTotal(items);
        expect(second).toBe(first);
    });

    test("recomputes when array reference changes", () => {
        const itemsA = [{ price: 100, quantity: 1 }];
        const itemsB = [{ price: 200, quantity: 1 }];
        expect(calcOrderTotal(itemsA)).toBe(100);
        expect(calcOrderTotal(itemsB)).toBe(200);
    });
});

describe("calcOrderCostprice", () => {
    test("returns sum of product.costprice * quantity", () => {
        const items = [
            { product: { costprice: 50 }, quantity: 2 },
            { product: { costprice: 30 }, quantity: 4 },
        ];
        expect(calcOrderCostprice(items)).toBe(220);
    });

    test("treats missing product/costprice as 0", () => {
        const items = [
            { product: null, quantity: 2 },
            { product: { costprice: null }, quantity: 1 },
        ];
        expect(calcOrderCostprice(items)).toBe(0);
    });

    test("returns 0 for empty array", () => {
        expect(calcOrderCostprice([])).toBe(0);
    });

    test("memoizes result by array reference", () => {
        const product = { costprice: 100 };
        const items = [{ product, quantity: 2 }];
        const first = calcOrderCostprice(items);
        product.costprice = 9999;
        const second = calcOrderCostprice(items);
        expect(second).toBe(first);
    });
});
