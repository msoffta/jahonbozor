import { prisma } from "@backend/lib/prisma";

const MAX_CATEGORY_DEPTH = 10;

/**
 * Get all descendant category IDs for hierarchical filtering.
 * Recursively traverses the category tree up to MAX_CATEGORY_DEPTH levels.
 */
export async function getCategoryWithDescendants(
	categoryId: number,
	depth = 0,
): Promise<number[]> {
	if (depth >= MAX_CATEGORY_DEPTH) return [categoryId];

	const ids = [categoryId];

	const children = await prisma.category.findMany({
		where: { parentId: categoryId },
		select: { id: true },
	});

	for (const child of children) {
		const descendantIds = await getCategoryWithDescendants(child.id, depth + 1);
		ids.push(...descendantIds);
	}

	return ids;
}
