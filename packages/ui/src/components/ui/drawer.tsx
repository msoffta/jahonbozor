import * as React from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "motion/react";

import { useIsMobile } from "../../hooks/use-is-mobile";
import { cn } from "../../lib/utils";

interface DrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

function Drawer({ open, onOpenChange, children }: DrawerProps) {
    const isMobile = useIsMobile();
    const isDesktop = !isMobile;

    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    // Mobile animation (slide up from bottom)
    const mobileVariants = {
        initial: { y: "100%", opacity: 1, scale: 1 },
        animate: { y: 0, opacity: 1, scale: 1 },
        exit: { y: "100%", opacity: 1, scale: 1 },
    };

    // Desktop animation (centered with subtle scale)
    const desktopVariants = {
        initial: { scale: 0.95, opacity: 0, y: 0 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.95, opacity: 0, y: 0 },
    };

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center">
                    <motion.div
                        className="bg-overlay fixed inset-0 backdrop-blur-xs"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => onOpenChange(false)}
                    />
                    <motion.div
                        className={cn(
                            "bg-background relative z-50 flex flex-col overflow-hidden shadow-2xl",
                            // Mobile: bottom sheet
                            "bottom-0 max-h-[92vh] w-full rounded-t-[24px]",
                            // Desktop: centered modal (max 800px wide, 90vh tall)
                            "md:border-border/50 md:bottom-auto md:h-auto md:max-h-[90vh] md:w-full md:max-w-[800px] md:rounded-3xl md:border",
                        )}
                        initial={isDesktop ? desktopVariants.initial : mobileVariants.initial}
                        animate={isDesktop ? desktopVariants.animate : mobileVariants.animate}
                        exit={isDesktop ? desktopVariants.exit : mobileVariants.exit}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                        }}
                    >
                        {/* Swipe handle (mobile only) */}
                        <div className="bg-muted/50 mx-auto mt-3 mb-2 h-1.5 w-12 shrink-0 rounded-full md:hidden" />

                        <div className="flex h-full min-h-0 flex-col">{children}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("px-6 pt-4 pb-2 text-center md:pt-8 md:pb-4 md:text-left", className)}
            {...props}
        />
    );
}

function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2
            className={cn(
                "text-foreground text-xl font-bold tracking-tight md:text-2xl",
                className,
            )}
            {...props}
        />
    );
}

function DrawerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-2", className)}
            {...props}
        />
    );
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("bg-muted/5 mt-auto border-t px-6 py-4 md:py-6", className)}
            {...props}
        />
    );
}

function ScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("custom-scrollbar overflow-y-auto pr-2", className)} {...props} />;
}

export { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, ScrollArea };
