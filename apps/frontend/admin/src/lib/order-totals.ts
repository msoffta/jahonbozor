interface OrderItemForTotal {
    price?: number | null;
    quantity?: number | null;
}

interface OrderItemForCostprice {
    product?: { costprice?: number | null } | null;
    quantity?: number | null;
}

const totalCache = new WeakMap<readonly OrderItemForTotal[], number>();
const costpriceCache = new WeakMap<readonly OrderItemForCostprice[], number>();

export function calcOrderTotal(items: readonly OrderItemForTotal[]): number {
    const cached = totalCache.get(items);
    if (cached !== undefined) return cached;
    let sum = 0;
    for (const item of items) {
        sum += (item.price ?? 0) * (item.quantity ?? 1);
    }
    totalCache.set(items, sum);
    return sum;
}

export function calcOrderCostprice(items: readonly OrderItemForCostprice[]): number {
    const cached = costpriceCache.get(items);
    if (cached !== undefined) return cached;
    let sum = 0;
    for (const item of items) {
        sum += (item.product?.costprice ?? 0) * (item.quantity ?? 1);
    }
    costpriceCache.set(items, sum);
    return sum;
}
