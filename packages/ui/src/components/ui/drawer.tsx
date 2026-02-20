import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

interface DrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

function Drawer({ open, onOpenChange, children }: DrawerProps) {
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = ""; };
        }
    }, [open]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 z-50 bg-black/40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => onOpenChange(false)}
                    />
                    <motion.div
                        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-background"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                        <div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("px-4 pb-2", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn("text-lg font-semibold text-foreground", className)} {...props} />;
}

export { Drawer, DrawerHeader, DrawerTitle };
