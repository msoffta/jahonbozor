import { beforeEach, describe, expect, test } from "vitest";

import { prismaMock } from "@backend/test/setup";

import { getCategoryWithDescendants } from "../categories";

import type { Category } from "@backend/generated/prisma/client";

describe("getCategoryWithDescendants", () => {
    beforeEach(() => {
        // prismaMock is reset by test/setup.ts beforeEach
    });

    test("should return only the root category when it has no children", async () => {
        prismaMock.category.findMany.mockResolvedValueOnce([]);

        const result = await getCategoryWithDescendants(1);

        expect(result).toEqual([1]);
        expect(prismaMock.category.findMany).toHaveBeenCalledWith({
            where: { parentId: 1 },
            select: { id: true },
        });
    });

    test("should return root + children for single-level hierarchy", async () => {
        prismaMock.category.findMany
            .mockResolvedValueOnce([{ id: 2 }, { id: 3 }] as Category[])
            .mockResolvedValueOnce([]) // children of 2
            .mockResolvedValueOnce([]); // children of 3

        const result = await getCategoryWithDescendants(1);

        expect(result).toEqual([1, 2, 3]);
    });

    test("should traverse deep hierarchy (3 levels)", async () => {
        // Category 1 → 2 → 3
        prismaMock.category.findMany
            .mockResolvedValueOnce([{ id: 2 }] as Category[]) // children of 1
            .mockResolvedValueOnce([{ id: 3 }] as Category[]) // children of 2
            .mockResolvedValueOnce([]); // children of 3

        const result = await getCategoryWithDescendants(1);

        expect(result).toEqual([1, 2, 3]);
    });

    test("should handle branching hierarchy", async () => {
        // Category 1 → [2, 3], 2 → [4], 3 → []
        prismaMock.category.findMany
            .mockResolvedValueOnce([{ id: 2 }, { id: 3 }] as Category[]) // children of 1
            .mockResolvedValueOnce([{ id: 4 }] as Category[]) // children of 2
            .mockResolvedValueOnce([]) // children of 4
            .mockResolvedValueOnce([]); // children of 3

        const result = await getCategoryWithDescendants(1);

        expect(result).toEqual([1, 2, 4, 3]);
    });

    test("should stop at MAX_CATEGORY_DEPTH (10)", async () => {
        // Simulate a deep chain that would exceed depth 10
        // At depth=10, it should return [categoryId] without querying further
        const result = await getCategoryWithDescendants(99, 10);

        expect(result).toEqual([99]);
        // Should NOT have called findMany since depth >= MAX
        expect(prismaMock.category.findMany).not.toHaveBeenCalled();
    });

    test("should query children at depth 9 (one below max)", async () => {
        prismaMock.category.findMany.mockResolvedValueOnce([]);

        const result = await getCategoryWithDescendants(99, 9);

        expect(result).toEqual([99]);
        expect(prismaMock.category.findMany).toHaveBeenCalledTimes(1);
    });
});
