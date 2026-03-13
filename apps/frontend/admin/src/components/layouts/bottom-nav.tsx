import {
    orderDetailQueryOptions,
    ordersListQueryOptions,
} from "@/api/orders.api";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
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
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Home } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

const NavPill = React.memo(({ item, isActive, t }: { item: typeof navKeys[number], isActive: boolean, t: any }) => (
    <Link
        key={item.to}
        to={item.to}
        className="relative"
    >
        {isActive && (
            <motion.div
                layoutId="activeNavPill"
                className="absolute inset-0 rounded-lg bg-primary will-change-transform"
                transition={fastTransition}
            />
        )}
        <span
            className={cn(
                "relative z-10 block px-3 py-1.5 text-xs font-semibold uppercase transition-colors duration-200",
                isActive
                    ? "text-primary-foreground"
                    : "rounded-lg border border-border text-foreground",
            )}
        >
            {t(item.key)}
        </span>
    </Link>
));

NavPill.displayName = "NavPill";

export function BottomNav() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const { t } = useTranslation();
    const { t: tOrders } = useTranslation("orders");
    const [dialogOpen, setDialogOpen] = useState(false);

    const params = useParams({ strict: false });
    const activeOrderId = params?.orderId ? Number(params.orderId) : null;
    const isOrderView =
        pathname.startsWith("/orders/") && activeOrderId !== null;

    // Fetch today's lists (orders with >1 item)
    const todayStart = useMemo(() => dayjs().startOf("day").toISOString(), []);
    const { data: recentListsData } = useQuery(
        ordersListQueryOptions({ limit: 5, minItemsCount: 2, dateFrom: todayStart }),
    );

    const recentListsRaw = recentListsData?.orders ?? [];

    // Fetch active order if it is not in recent lists
    const { data: activeOrderData } = useQuery({
        ...orderDetailQueryOptions(activeOrderId || 0),
        enabled:
            isOrderView && !recentListsRaw.some((o) => o.id === activeOrderId),
    });

    const recentLists = useMemo(() => {
        const combined = [...recentListsRaw];
        if (
            activeOrderData &&
            !combined.some((o) => o.id === activeOrderData.id)
        ) {
            // Add at the beginning
            combined.unshift(activeOrderData);
        }
        return combined;
    }, [recentListsRaw, activeOrderData]);

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-border bg-surface">
                {/* Main nav bar */}
                <div className="flex h-14 items-center justify-between px-6">
                    <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
                        <Link to="/orders">
                            <motion.button
                                type="button"
                                className={cn(
                                    "shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold uppercase",
                                    pathname === "/orders" ||
                                        pathname === "/orders/"
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
                        <motion.button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-semibold text-foreground"
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

                        {/* Recent lists pills — inline between + and Home */}
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
                                                        "shrink-0 rounded-lg border px-3 py-1.5 text-xs uppercase transition-colors",
                                                        pathname ===
                                                            `/orders/${order.id}`
                                                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-md"
                                                            : "border-border text-foreground font-semibold hover:bg-accent hover:text-accent-foreground",
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
                                                    {tOrders("list_number", {
                                                        number: order.id,
                                                    })}
                                                </motion.div>
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="top"
                                            className="w-auto px-3 py-2 text-xs"
                                        >
                                            <p className="font-medium">
                                                {order.user?.fullname ?? "—"}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {dayjs(order.createdAt).format(
                                                    "DD.MM.YYYY HH:mm",
                                                )}
                                            </p>
                                        </TooltipContent>
                                        </Tooltip>
                                    </React.Fragment>
                                ))}
                            </AnimatePresence>
                        </TooltipProvider>
                    </div>

                    <Link to="/" className="shrink-0 mx-4">
                        <motion.div
                            className={cn(
                                "flex h-11 w-20 items-center justify-center rounded-xl will-change-transform",
                                pathname === "/"
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground border border-border bg-background/50",
                            )}
                            whileTap={{ scale: 0.92 }}
                            transition={fastTransition}
                        >
                            <Home className="h-6 w-6" />
                        </motion.div>
                    </Link>

                    <LayoutGroup id="bottom-navigation">
                        <div className="flex flex-1 items-center justify-end gap-1.5">
                            {navKeys.map((item) => (
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
