import { useTranslation } from "react-i18next";

import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Home, ShoppingCart, User } from "lucide-react";

import { AnimatePresence, cn, motion } from "@jahonbozor/ui";

import { useCartStore } from "@/stores/cart.store";

const navItems = [
    { to: "/", icon: Home, labelKey: "home" },
    { to: "/cart", icon: ShoppingCart, labelKey: "cart" },
    { to: "/orders", icon: ClipboardList, labelKey: "orders" },
    { to: "/profile", icon: User, labelKey: "profile" },
] as const;

export function BottomNav() {
    const { t } = useTranslation();
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const totalItems = useCartStore((state) =>
        state.items.reduce((sum, item) => sum + item.quantity, 0),
    );

    return (
        <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-50">
            <div className="h-24 bg-linear-to-t from-black/40 to-stone-500/0 backdrop-blur-[2px]" />
            <nav className="bg-accent pointer-events-auto absolute right-4 bottom-4 left-4 flex h-14 items-center justify-between rounded-2xl px-3">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            aria-label={t(item.labelKey)}
                            className="flex flex-col items-center"
                        >
                            <motion.div
                                className={cn(
                                    "relative flex size-11 items-center justify-center rounded-full",
                                    isActive && "bg-accent-muted",
                                )}
                                whileTap={{ scale: 0.85 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Icon className="text-accent-foreground size-6" />
                                <AnimatePresence>
                                    {item.to === "/cart" && totalItems > 0 && (
                                        <motion.span
                                            key="badge"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="bg-surface text-accent absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full text-[10px] font-bold"
                                        >
                                            {totalItems}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
