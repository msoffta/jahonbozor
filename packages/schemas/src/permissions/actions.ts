export const Action = {
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
    LIST: "list",
} as const;

export type Action = (typeof Action)[keyof typeof Action];

export const ALL_ACTIONS = Object.values(Action);
