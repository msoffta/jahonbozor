// Permission format: resource:action or resource:action:scope
export const Permission = {
    // === USERS ===
    USERS_CREATE: "users:create",
    USERS_READ_OWN: "users:read:own",
    USERS_READ_ALL: "users:read:all",
    USERS_UPDATE_OWN: "users:update:own",
    USERS_UPDATE_ALL: "users:update:all",
    USERS_DELETE: "users:delete",
    USERS_LIST: "users:list",

    // === STAFF ===
    STAFF_CREATE: "staff:create",
    STAFF_READ_OWN: "staff:read:own",
    STAFF_READ_ALL: "staff:read:all",
    STAFF_UPDATE_OWN: "staff:update:own",
    STAFF_UPDATE_ALL: "staff:update:all",
    STAFF_DELETE: "staff:delete",
    STAFF_LIST: "staff:list",

    // === ROLES ===
    ROLES_CREATE: "roles:create",
    ROLES_READ: "roles:read",
    ROLES_UPDATE: "roles:update",
    ROLES_DELETE: "roles:delete",
    ROLES_LIST: "roles:list",

    // === PRODUCTS ===
    PRODUCTS_CREATE: "products:create",
    PRODUCTS_READ: "products:read",
    PRODUCTS_UPDATE: "products:update",
    PRODUCTS_DELETE: "products:delete",
    PRODUCTS_LIST: "products:list",

    // === CATEGORIES ===
    CATEGORIES_CREATE: "categories:create",
    CATEGORIES_READ: "categories:read",
    CATEGORIES_UPDATE: "categories:update",
    CATEGORIES_DELETE: "categories:delete",
    CATEGORIES_LIST: "categories:list",

    // === SUBCATEGORIES ===
    SUBCATEGORIES_CREATE: "subcategories:create",
    SUBCATEGORIES_READ: "subcategories:read",
    SUBCATEGORIES_UPDATE: "subcategories:update",
    SUBCATEGORIES_DELETE: "subcategories:delete",
    SUBCATEGORIES_LIST: "subcategories:list",

    // === ORDERS ===
    ORDERS_CREATE: "orders:create",
    ORDERS_READ_OWN: "orders:read:own",
    ORDERS_READ_ALL: "orders:read:all",
    ORDERS_UPDATE_OWN: "orders:update:own",
    ORDERS_UPDATE_ALL: "orders:update:all",
    ORDERS_DELETE: "orders:delete",
    ORDERS_LIST_OWN: "orders:list:own",
    ORDERS_LIST_ALL: "orders:list:all",

    // === PRODUCT HISTORY (read-only by design) ===
    PRODUCT_HISTORY_CREATE: "product-history:create",
    PRODUCT_HISTORY_READ: "product-history:read",
    PRODUCT_HISTORY_LIST: "product-history:list",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// Tuple type for Zod enum (preserves literal types)
export const ALL_PERMISSIONS = Object.values(Permission) as [
    Permission,
    ...Permission[],
];

// Permission groups for convenience
export const PermissionGroups = {
    USERS_ALL: [
        Permission.USERS_CREATE,
        Permission.USERS_READ_ALL,
        Permission.USERS_UPDATE_ALL,
        Permission.USERS_DELETE,
        Permission.USERS_LIST,
    ],
    STAFF_ALL: [
        Permission.STAFF_CREATE,
        Permission.STAFF_READ_ALL,
        Permission.STAFF_UPDATE_ALL,
        Permission.STAFF_DELETE,
        Permission.STAFF_LIST,
    ],
    ROLES_ALL: [
        Permission.ROLES_CREATE,
        Permission.ROLES_READ,
        Permission.ROLES_UPDATE,
        Permission.ROLES_DELETE,
        Permission.ROLES_LIST,
    ],
    PRODUCTS_ALL: [
        Permission.PRODUCTS_CREATE,
        Permission.PRODUCTS_READ,
        Permission.PRODUCTS_UPDATE,
        Permission.PRODUCTS_DELETE,
        Permission.PRODUCTS_LIST,
    ],
    CATEGORIES_ALL: [
        Permission.CATEGORIES_CREATE,
        Permission.CATEGORIES_READ,
        Permission.CATEGORIES_UPDATE,
        Permission.CATEGORIES_DELETE,
        Permission.CATEGORIES_LIST,
    ],
    SUBCATEGORIES_ALL: [
        Permission.SUBCATEGORIES_CREATE,
        Permission.SUBCATEGORIES_READ,
        Permission.SUBCATEGORIES_UPDATE,
        Permission.SUBCATEGORIES_DELETE,
        Permission.SUBCATEGORIES_LIST,
    ],
    ORDERS_ALL: [
        Permission.ORDERS_CREATE,
        Permission.ORDERS_READ_ALL,
        Permission.ORDERS_UPDATE_ALL,
        Permission.ORDERS_DELETE,
        Permission.ORDERS_LIST_ALL,
    ],
    PRODUCT_HISTORY_ALL: [
        Permission.PRODUCT_HISTORY_CREATE,
        Permission.PRODUCT_HISTORY_READ,
        Permission.PRODUCT_HISTORY_LIST,
    ],
} as const;
