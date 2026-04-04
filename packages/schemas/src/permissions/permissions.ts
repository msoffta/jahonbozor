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

    // === ORDERS ===
    ORDERS_CREATE: "orders:create",
    ORDERS_READ_OWN: "orders:read:own",
    ORDERS_READ_ALL: "orders:read:all",
    ORDERS_UPDATE_OWN: "orders:update:own",
    ORDERS_UPDATE_ALL: "orders:update:all",
    ORDERS_DELETE: "orders:delete",
    ORDERS_LIST_OWN: "orders:list:own",
    ORDERS_LIST_ALL: "orders:list:all",

    // === EXPENSES ===
    EXPENSES_CREATE: "expenses:create",
    EXPENSES_READ: "expenses:read",
    EXPENSES_UPDATE: "expenses:update",
    EXPENSES_DELETE: "expenses:delete",
    EXPENSES_LIST: "expenses:list",

    // === PRODUCT HISTORY (read-only by design) ===
    PRODUCT_HISTORY_CREATE: "product-history:create",
    PRODUCT_HISTORY_READ: "product-history:read",
    PRODUCT_HISTORY_LIST: "product-history:list",

    // === AUDIT LOGS (read-only by design) ===
    AUDIT_LOGS_LIST: "audit-logs:list",
    AUDIT_LOGS_READ: "audit-logs:read",

    // === DEBTS ===
    DEBTS_LIST: "debts:list",
    DEBTS_READ: "debts:read",
    DEBTS_CREATE_PAYMENT: "debts:create:payment",

    // === ANALYTICS ===
    ANALYTICS_VIEW: "analytics:view",

    // === TELEGRAM SESSIONS ===
    TELEGRAM_SESSIONS_CREATE: "telegram-sessions:create",
    TELEGRAM_SESSIONS_READ: "telegram-sessions:read",
    TELEGRAM_SESSIONS_UPDATE: "telegram-sessions:update",
    TELEGRAM_SESSIONS_DELETE: "telegram-sessions:delete",
    TELEGRAM_SESSIONS_LIST: "telegram-sessions:list",

    // === BROADCAST TEMPLATES ===
    BROADCAST_TEMPLATES_CREATE: "broadcast-templates:create",
    BROADCAST_TEMPLATES_READ: "broadcast-templates:read",
    BROADCAST_TEMPLATES_UPDATE: "broadcast-templates:update",
    BROADCAST_TEMPLATES_DELETE: "broadcast-templates:delete",
    BROADCAST_TEMPLATES_LIST: "broadcast-templates:list",

    // === BROADCASTS ===
    BROADCASTS_CREATE: "broadcasts:create",
    BROADCASTS_READ: "broadcasts:read",
    BROADCASTS_UPDATE: "broadcasts:update",
    BROADCASTS_DELETE: "broadcasts:delete",
    BROADCASTS_LIST: "broadcasts:list",
    BROADCASTS_SEND: "broadcasts:send",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// Tuple type for Zod enum (preserves literal types)
export const ALL_PERMISSIONS = Object.values(Permission) as [Permission, ...Permission[]];

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
    ORDERS_ALL: [
        Permission.ORDERS_CREATE,
        Permission.ORDERS_READ_ALL,
        Permission.ORDERS_UPDATE_ALL,
        Permission.ORDERS_DELETE,
        Permission.ORDERS_LIST_ALL,
    ],
    EXPENSES_ALL: [
        Permission.EXPENSES_CREATE,
        Permission.EXPENSES_READ,
        Permission.EXPENSES_UPDATE,
        Permission.EXPENSES_DELETE,
        Permission.EXPENSES_LIST,
    ],
    PRODUCT_HISTORY_ALL: [
        Permission.PRODUCT_HISTORY_CREATE,
        Permission.PRODUCT_HISTORY_READ,
        Permission.PRODUCT_HISTORY_LIST,
    ],
    AUDIT_LOGS_ALL: [Permission.AUDIT_LOGS_LIST, Permission.AUDIT_LOGS_READ],
    DEBTS_ALL: [Permission.DEBTS_LIST, Permission.DEBTS_READ, Permission.DEBTS_CREATE_PAYMENT],
    ANALYTICS_ALL: [Permission.ANALYTICS_VIEW],
    TELEGRAM_SESSIONS_ALL: [
        Permission.TELEGRAM_SESSIONS_CREATE,
        Permission.TELEGRAM_SESSIONS_READ,
        Permission.TELEGRAM_SESSIONS_UPDATE,
        Permission.TELEGRAM_SESSIONS_DELETE,
        Permission.TELEGRAM_SESSIONS_LIST,
    ],
    BROADCAST_TEMPLATES_ALL: [
        Permission.BROADCAST_TEMPLATES_CREATE,
        Permission.BROADCAST_TEMPLATES_READ,
        Permission.BROADCAST_TEMPLATES_UPDATE,
        Permission.BROADCAST_TEMPLATES_DELETE,
        Permission.BROADCAST_TEMPLATES_LIST,
    ],
    BROADCASTS_ALL: [
        Permission.BROADCASTS_CREATE,
        Permission.BROADCASTS_READ,
        Permission.BROADCASTS_UPDATE,
        Permission.BROADCASTS_DELETE,
        Permission.BROADCASTS_LIST,
        Permission.BROADCASTS_SEND,
    ],
} as const;
