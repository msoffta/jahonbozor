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
    const [isDesktop, setIsDesktop] = React.useState(false);

    React.useEffect(() => {
        const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 768);
        checkIsDesktop();
        window.addEventListener("resize", checkIsDesktop);
        return () => window.removeEventListener("resize", checkIsDesktop);
    }, []);

    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = ""; };
        }
    }, [open]);

    // Анимация для мобилок (выезд снизу)
    const mobileVariants = {
        initial: { y: "100%", opacity: 1, scale: 1 },
        animate: { y: 0, opacity: 1, scale: 1 },
        exit: { y: "100%", opacity: 1, scale: 1 },
    };

    // Анимация для ПК (появление по центру с легким масштабированием)
    const desktopVariants = {
        initial: { scale: 0.95, opacity: 0, y: 0 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.95, opacity: 0, y: 0 },
    };

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-4">
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-[4px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => onOpenChange(false)}
                    />
                    <motion.div
                        className={cn(
                            "relative z-50 flex flex-col bg-background shadow-2xl overflow-hidden",
                            // Mobile: шторка снизу
                            "w-full rounded-t-[24px] max-h-[92vh] bottom-0", 
                            // Desktop: модалка по центру (увеличена ширина до 800px и высота до 90vh)
                            "md:max-w-[800px] md:w-full md:h-auto md:max-h-[90vh] md:rounded-3xl md:bottom-auto md:border md:border-border/50" 
                        )}
                        initial={isDesktop ? desktopVariants.initial : mobileVariants.initial}
                        animate={isDesktop ? desktopVariants.animate : mobileVariants.animate}
                        exit={isDesktop ? desktopVariants.exit : mobileVariants.exit}
                        transition={{ 
                            type: isDesktop ? "tween" : "spring", 
                            stiffness: 300, 
                            damping: 30,
                            duration: isDesktop ? 0.2 : undefined
                        }}
                    >
                        {/* Полоска для свайпа только на мобилках */}
                        <div className="mx-auto mt-3 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-muted/50 md:hidden" />
                        
                        <div className="flex flex-col h-full min-h-0">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("px-6 pt-4 pb-2 md:pt-8 md:pb-4 text-center md:text-left", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn("text-xl md:text-2xl font-bold text-foreground tracking-tight", className)} {...props} />;
}

function DrawerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-2", className)} {...props} />;
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("px-6 py-4 border-t bg-muted/5 md:py-6 mt-auto", className)} {...props} />;
}

function ScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("overflow-y-auto pr-2 custom-scrollbar", className)} {...props} />;
}

export { Drawer, DrawerHeader, DrawerTitle, DrawerContent, DrawerFooter, ScrollArea };
