import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { format, startOfDay } from "date-fns";
import { Home } from "lucide-react";

import { Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    cn,
    LayoutGroup,
    motion,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@jahonbozor/ui";

import { orderDetailQueryOptions, ordersListQueryOptions } from "@/api/orders.api";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { useHasAnyPermission, useHasPermission } from "@/hooks/use-permissions";

const navKeys = [
    { to: "/income", key: "income" },
    { to: "/users", key: "clients" },
    { to: "/expense", key: "expense" },
    { to: "/products", key: "warehouse" },
    { to: "/summary", key: "summary" },
] as const;

// Fast, low-computation transition
const fastTransition = {
    type: "spring" as const,
    stiffness: 500,
    damping: 40,
    mass: 1,
};

function formatPillLabel(fullname: string | undefined | null, index: number): string {
    const seq = index + 1;
    if (!fullname) return String(seq);
    const MAX_NAME_LENGTH = 4;
    const truncated =
        fullname.length > MAX_NAME_LENGTH ? `${fullname.slice(0, MAX_NAME_LENGTH)}…` : fullname;
    return `${truncated} ${seq}`;
}

const NavPill = React.memo(
    ({
        item,
        isActive,
        t,
    }: {
        item: (typeof navKeys)[number];
        isActive: boolean;
        t: (key: string) => string;
    }) => (
        <Link key={item.to} to={item.to} className="relative">
            {isActive && (
                <motion.div
                    layoutId="activeNavPill"
                    className="bg-primary absolute inset-0 rounded-lg will-change-transform"
                    transition={fastTransition}
                />
            )}
            <span
                className={cn(
                    "relative z-10 block px-3 py-1.5 text-xs font-semibold uppercase transition-colors duration-200",
                    isActive
                        ? "text-primary-foreground"
                        : "border-border text-foreground rounded-lg border",
                )}
            >
                {t(item.key)}
            </span>
        </Link>
    ),
);

NavPill.displayName = "NavPill";

export function BottomNav() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const { t } = useTranslation();

    const [dialogOpen, setDialogOpen] = useState(false);

    // Permission checks for navigation filtering
    const hasAnalyticsPermission = useHasPermission(Permission.ANALYTICS_VIEW);
    const hasIncomePermission = useHasPermission(Permission.PRODUCT_HISTORY_LIST);
    const hasUsersPermission = useHasPermission(Permission.USERS_LIST);
    const hasExpensesPermission = useHasPermission(Permission.EXPENSES_LIST);
    const hasProductsPermission = useHasPermission(Permission.PRODUCTS_LIST);

    // Permission checks for action buttons
    const canCreateOrders = useHasPermission(Permission.ORDERS_CREATE);
    const canListOrders = useHasAnyPermission([
        Permission.ORDERS_LIST_ALL,
        Permission.ORDERS_LIST_OWN,
    ]);

    const params = useParams({ strict: false });

    const activeOrderId = params?.orderId ? Number(params.orderId) : null;
    const isOrderView = pathname.startsWith("/orders/") && activeOrderId !== null;

    // Fetch today's lists (orders with >1 item)
    const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
    const { data: recentListsData } = useQuery(
        ordersListQueryOptions({ limit: 5, minItemsCount: 2, dateFrom: todayStart }),
    );

    const recentListsRaw = recentListsData?.orders ?? [];

    // Fetch active order if it is not in recent lists
    const { data: activeOrderData } = useQuery({
        ...orderDetailQueryOptions(activeOrderId ?? 0),
        enabled: isOrderView && !recentListsRaw.some((o) => o.id === activeOrderId),
    });

    const recentLists = useMemo(() => {
        const combined = [...recentListsRaw];
        if (activeOrderData && !combined.some((o) => o.id === activeOrderData.id)) {
            // Add at the beginning
            combined.unshift(activeOrderData);
        }
        return combined;
    }, [recentListsRaw, activeOrderData]);

    const filteredNavKeys = useMemo(
        () =>
            navKeys.filter((item) => {
                if (item.to === "/income") return hasIncomePermission;
                if (item.to === "/users") return hasUsersPermission;
                if (item.to === "/expense") return hasExpensesPermission;
                if (item.to === "/products") return hasProductsPermission;
                if (item.to === "/summary") return hasAnalyticsPermission;
                return true;
            }),
        [
            hasIncomePermission,
            hasUsersPermission,
            hasExpensesPermission,
            hasProductsPermission,
            hasAnalyticsPermission,
        ],
    );

    const orderPills = (
        <TooltipProvider delayDuration={200}>
            <AnimatePresence>
                {recentLists.map((order, index) => (
                    <React.Fragment key={order.id}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link
                                    to="/orders/$orderId"
                                    params={{
                                        orderId: String(order.id),
                                    }}
                                >
                                    <motion.div
                                        className={cn(
                                            "shrink-0 rounded-lg border px-2 py-1 text-[11px] uppercase transition-colors md:px-3 md:py-1.5 md:text-xs",
                                            pathname === `/orders/${order.id}`
                                                ? "bg-primary text-primary-foreground border-primary font-bold shadow-md"
                                                : "border-border text-foreground hover:bg-accent hover:text-accent-foreground font-semibold",
                                            (order as { status?: string }).status === "DRAFT" &&
                                                pathname !== `/orders/${order.id}` &&
                                                "border-dashed border-yellow-500/60",
                                        )}
                                        initial={{
                                            scale: 0,
                                            opacity: 0,
                                        }}
                                        animate={{
                                            scale: 1,
                                            opacity: 1,
                                        }}
                                        exit={{
                                            scale: 0,
                                            opacity: 0,
                                        }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 17,
                                            delay: index * 0.05,
                                        }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        {formatPillLabel(order.user?.fullname, index)}
                                    </motion.div>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="w-auto px-3 py-2 text-xs">
                                <p className="font-medium">{order.user?.fullname ?? "—"}</p>
                                <p className="text-muted-foreground">
                                    {format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </React.Fragment>
                ))}
            </AnimatePresence>
        </TooltipProvider>
    );

    return (
        <>
            <nav className="border-border bg-background fixed right-0 bottom-0 left-0 z-50 flex flex-col border-t pb-[env(safe-area-inset-bottom)]">
                {/* Mobile: Row 1 — Nav pills */}
                <LayoutGroup id="bottom-navigation-mobile">
                    <div className="scrollbar-none flex items-center gap-1 overflow-x-auto px-3 py-1.5 md:hidden">
                        {filteredNavKeys.map((item) => (
                            <NavPill
                                key={item.to}
                                item={item}
                                isActive={pathname.startsWith(item.to)}
                                t={t}
                            />
                        ))}
                    </div>
                </LayoutGroup>

                {/* Row 2 (mobile) / Single row (desktop): Orders + Home + Desktop nav */}
                <div className="flex h-12 items-center justify-between px-3 md:h-14 md:px-6">
                    <div className="scrollbar-none flex flex-1 items-center gap-1.5 overflow-x-auto">
                        {canListOrders && (
                            <Link to="/orders">
                                <motion.button
                                    type="button"
                                    className={cn(
                                        "border-border shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase md:px-3 md:py-1.5 md:text-xs",
                                        pathname === "/orders" || pathname === "/orders/"
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "text-foreground",
                                    )}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 17,
                                    }}
                                >
                                    {t("list")}
                                </motion.button>
                            </Link>
                        )}
                        {canCreateOrders && (
                            <motion.button
                                type="button"
                                className="border-border text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-base font-semibold md:h-8 md:w-8 md:text-lg"
                                whileTap={{ scale: 0.9, rotate: 90 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 17,
                                }}
                                onClick={() => setDialogOpen(true)}
                            >
                                +
                            </motion.button>
                        )}

                        {orderPills}
                    </div>

                    <Link to="/" className="mx-2 shrink-0 md:mx-4">
                        <motion.div
                            className={cn(
                                "flex h-10 w-16 items-center justify-center rounded-xl will-change-transform md:h-11 md:w-20",
                                pathname === "/"
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "bg-orange-500 text-white",
                            )}
                            whileTap={{ scale: 0.92 }}
                            transition={fastTransition}
                        >
                            <Home className="h-5 w-5 md:h-6 md:w-6" />
                        </motion.div>
                    </Link>

                    {/* Desktop only: Nav pills on the right */}
                    <LayoutGroup id="bottom-navigation">
                        <div className="hidden flex-1 items-center justify-end gap-1.5 md:flex">
                            {filteredNavKeys.map((item) => (
                                <NavPill
                                    key={item.to}
                                    item={item}
                                    isActive={pathname.startsWith(item.to)}
                                    t={t}
                                />
                            ))}
                        </div>
                    </LayoutGroup>
                </div>
            </nav>

            <CreateOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </>
    );
}
