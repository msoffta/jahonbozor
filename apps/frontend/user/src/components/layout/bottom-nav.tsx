import { Home, ShoppingCart, ClipboardList, User } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCartStore } from "@/stores/cart.store";
import { cn, motion, AnimatePresence } from "@jahonbozor/ui";

const navItems = [
    { to: "/", icon: Home, labelKey: "home" },
    { to: "/cart", icon: ShoppingCart, labelKey: "cart" },
    { to: "/orders", icon: ClipboardList, labelKey: "orders" },
    { to: "/profile", icon: User, labelKey: "profile" },
] as const;

export function BottomNav() {
    const { t } = useTranslation();
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const totalItems = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
            <div className="h-24 bg-linear-to-t from-black/40 to-stone-500/0 backdrop-blur-[2px]" />
            <nav className="absolute bottom-4 left-4 right-4 flex h-14 items-center justify-between px-3 bg-accent rounded-2xl pointer-events-auto">
                {navItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive =
                        item.to === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.to);

                    return (
                        <Link
                            key={index}
                            to={item.to}
                            aria-label={t(item.labelKey)}
                            className="flex flex-col items-center"
                        >
                            <motion.div
                                className={cn(
                                    "relative flex items-center justify-center size-11 rounded-full",
                                    isActive && "bg-accent-muted",
                                )}
                                whileTap={{ scale: 0.85 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Icon className="size-6 text-accent-foreground" />
                                <AnimatePresence>
                                    {item.to === "/cart" && totalItems > 0 && (
                                        <motion.span
                                            key="badge"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-accent"
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
