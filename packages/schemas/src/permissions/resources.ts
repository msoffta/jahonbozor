export const Resource = {
    USERS: "users",
    STAFF: "staff",
    ROLES: "roles",
    PRODUCTS: "products",
    CATEGORIES: "categories",
    SUBCATEGORIES: "subcategories",
    ORDERS: "orders",
    PRODUCT_HISTORY: "product-history",
    ANALYTICS: "analytics",
} as const;

export type Resource = (typeof Resource)[keyof typeof Resource];

export const ALL_RESOURCES = Object.values(Resource);
