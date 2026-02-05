export const Scope = {
    OWN: "own",
    ALL: "all",
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

export const ALL_SCOPES = Object.values(Scope);
