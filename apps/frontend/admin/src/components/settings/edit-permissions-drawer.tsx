import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    BarChart3,
    CreditCard,
    DollarSign,
    FileSearch,
    History,
    Key,
    Layers,
    Package,
    Search,
    ShieldCheck,
    ShoppingCart,
    Users,
} from "lucide-react";

import { PermissionGroups } from "@jahonbozor/schemas";
import {
    Badge,
    Button,
    Checkbox,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    Input,
    ScrollArea,
    Separator,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@jahonbozor/ui";

import type { RoleItem } from "@jahonbozor/schemas/src/roles";

const PERMISSION_SECTIONS = [
    { key: "people", groupKeys: ["users", "staff", "roles"] },
    { key: "catalog", groupKeys: ["products", "categories", "producthistory"] },
    { key: "sales_finance", groupKeys: ["orders", "debts", "expenses"] },
    { key: "system", groupKeys: ["auditlogs", "analytics"] },
];

interface EditPermissionsDrawerProps {
    role: RoleItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (roleId: number, permissions: string[]) => Promise<void>;
}

export function EditPermissionsDrawer({
    role,
    open,
    onOpenChange,
    onSave,
}: EditPermissionsDrawerProps) {
    const { t } = useTranslation("settings");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRendered, setIsRendered] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedPermissions(role?.permissions ?? []);
            setSearchQuery("");
            startTransition(() => setIsRendered(true));
        } else {
            setIsRendered(false);
        }
    }, [open, role]);

    const handleToggle = (permission: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission],
        );
    };

    const handleToggleGroup = (groupPermissions: readonly string[]) => {
        const allSelected = groupPermissions.every((p) => selectedPermissions.includes(p));

        if (allSelected) {
            setSelectedPermissions((prev) => prev.filter((p) => !groupPermissions.includes(p)));
        } else {
            setSelectedPermissions((prev) => {
                const newSet = new Set([...prev, ...groupPermissions]);
                return Array.from(newSet);
            });
        }
    };

    const handleSave = async () => {
        if (!role) return;
        setIsSaving(true);
        try {
            await onSave(role.id, selectedPermissions);
        } finally {
            setIsSaving(false);
        }
    };

    const permissionGroups = useMemo(
        () => [
            { key: "users", icon: Users, permissions: PermissionGroups.USERS_ALL },
            { key: "staff", icon: ShieldCheck, permissions: PermissionGroups.STAFF_ALL },
            { key: "roles", icon: Key, permissions: PermissionGroups.ROLES_ALL },
            { key: "products", icon: Package, permissions: PermissionGroups.PRODUCTS_ALL },
            { key: "categories", icon: Layers, permissions: PermissionGroups.CATEGORIES_ALL },
            {
                key: "producthistory",
                icon: History,
                permissions: PermissionGroups.PRODUCT_HISTORY_ALL ?? [],
            },
            { key: "orders", icon: ShoppingCart, permissions: PermissionGroups.ORDERS_ALL },
            { key: "debts", icon: CreditCard, permissions: PermissionGroups.DEBTS_ALL },
            { key: "expenses", icon: DollarSign, permissions: PermissionGroups.EXPENSES_ALL },
            {
                key: "auditlogs",
                icon: FileSearch,
                permissions: PermissionGroups.AUDIT_LOGS_ALL ?? [],
            },
            { key: "analytics", icon: BarChart3, permissions: PermissionGroups.ANALYTICS_ALL },
        ],
        [],
    );

    const filteredGroups = useMemo(() => {
        if (!searchQuery) return permissionGroups;
        const query = searchQuery.toLowerCase();

        return permissionGroups
            .map((group) => {
                const groupName = t(`settings:permission_group_${group.key}`).toLowerCase();
                const isGroupNameMatch = groupName.includes(query);

                const filteredPermissions = isGroupNameMatch
                    ? group.permissions
                    : group.permissions.filter((p) => {
                          const dotKey = p.replaceAll(":", ".");
                          return (
                              t(`settings:perm_${dotKey}.title`).toLowerCase().includes(query) ||
                              t(`settings:perm_${dotKey}.desc`).toLowerCase().includes(query) ||
                              p.toLowerCase().includes(query)
                          );
                      });

                return {
                    ...group,
                    permissions: filteredPermissions,
                };
            })
            .filter((group) => group.permissions.length > 0);
    }, [permissionGroups, searchQuery, t]);

    if (!role) return null;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-xl font-bold">
                            {t("edit_permissions_title", { roleName: role.name })}
                        </DrawerTitle>
                        <Badge variant="secondary" className="px-3 py-1 font-mono">
                            {selectedPermissions.length} {t("permissions_selected")}
                        </Badge>
                    </div>
                    <div className="relative mt-4">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder={t("search_permissions_placeholder")}
                            className="bg-muted/30 h-11 border-none pl-10 focus-visible:ring-1"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </DrawerHeader>

                <TooltipProvider delayDuration={300}>
                    <ScrollArea className="flex-1 px-6">
                        {!isRendered ? (
                            <div className="space-y-8 py-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-10 w-10 rounded-lg" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                            <Skeleton className="h-14 rounded-xl" />
                                            <Skeleton className="h-14 rounded-xl" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2 py-6">
                                {PERMISSION_SECTIONS.map((section, sectionIndex) => {
                                    const sectionGroups = filteredGroups.filter((g) =>
                                        section.groupKeys.includes(g.key),
                                    );
                                    if (sectionGroups.length === 0) return null;

                                    return (
                                        <div key={section.key}>
                                            <div
                                                className={`flex items-center gap-2 pb-2 ${sectionIndex === 0 ? "pt-0" : "pt-4"}`}
                                            >
                                                <h2 className="text-muted-foreground text-xs font-semibold tracking-wider whitespace-nowrap uppercase">
                                                    {t(`permission_section_${section.key}`)}
                                                </h2>
                                                <Separator className="flex-1" />
                                            </div>

                                            <div className="space-y-8">
                                                {sectionGroups.map((group) => {
                                                    const groupPerms = group.permissions;
                                                    const allSelected =
                                                        groupPerms.length > 0 &&
                                                        groupPerms.every((p) =>
                                                            selectedPermissions.includes(p),
                                                        );
                                                    const Icon = group.icon;

                                                    return (
                                                        <div key={group.key} className="space-y-4">
                                                            <div className="bg-background/95 sticky top-0 z-10 flex items-center gap-3 py-2 backdrop-blur-sm">
                                                                <div className="bg-primary/10 text-primary rounded-lg p-2">
                                                                    <Icon className="h-5 w-5" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h3 className="text-sm font-bold">
                                                                        {t(
                                                                            `permission_group_${group.key}`,
                                                                        )}
                                                                    </h3>
                                                                    <p className="text-muted-foreground text-xs">
                                                                        {
                                                                            groupPerms.filter((p) =>
                                                                                selectedPermissions.includes(
                                                                                    p,
                                                                                ),
                                                                            ).length
                                                                        }{" "}
                                                                        / {groupPerms.length}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="hover:bg-primary/5 text-primary h-8 text-xs font-medium"
                                                                    onClick={() =>
                                                                        handleToggleGroup(
                                                                            groupPerms,
                                                                        )
                                                                    }
                                                                >
                                                                    {allSelected
                                                                        ? t("deselect_all")
                                                                        : t("select_all")}
                                                                </Button>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                                {groupPerms.map((permission) => {
                                                                    const isSelected =
                                                                        selectedPermissions.includes(
                                                                            permission,
                                                                        );
                                                                    const dotKey =
                                                                        permission.replaceAll(
                                                                            ":",
                                                                            ".",
                                                                        );
                                                                    const title = t(
                                                                        `settings:perm_${dotKey}.title`,
                                                                    );
                                                                    const description = t(
                                                                        `settings:perm_${dotKey}.desc`,
                                                                    );

                                                                    return (
                                                                        <Tooltip key={permission}>
                                                                            <TooltipTrigger asChild>
                                                                                <label
                                                                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all duration-200 ${
                                                                                        isSelected
                                                                                            ? "border-primary/40 bg-primary/3 shadow-sm"
                                                                                            : "hover:bg-muted/50 border-transparent"
                                                                                    }`}
                                                                                >
                                                                                    <div className="mt-0.5">
                                                                                        <Checkbox
                                                                                            checked={
                                                                                                isSelected
                                                                                            }
                                                                                            onCheckedChange={() =>
                                                                                                handleToggle(
                                                                                                    permission,
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex-1 space-y-0.5">
                                                                                        <span
                                                                                            className={`text-sm leading-none font-medium ${isSelected ? "text-primary" : ""}`}
                                                                                        >
                                                                                            {title}
                                                                                        </span>
                                                                                        <p className="text-muted-foreground/60 font-mono text-[10px]">
                                                                                            {
                                                                                                permission
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                </label>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent
                                                                                side="top"
                                                                                className="max-w-75 text-xs"
                                                                            >
                                                                                {description}
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredGroups.length === 0 && (
                                    <div className="text-muted-foreground flex flex-col items-center justify-center py-20">
                                        <Search className="mb-4 h-10 w-10 opacity-10" />
                                        <p>{t("no_permissions_found")}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </TooltipProvider>

                <DrawerFooter className="bg-background/95 border-t backdrop-blur-md">
                    <div className="flex w-full gap-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                            className="h-11 flex-1"
                        >
                            {t("common:cancel")}
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-11 flex-1 shadow-md"
                        >
                            {isSaving ? t("common:saving") : t("common:save")}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
