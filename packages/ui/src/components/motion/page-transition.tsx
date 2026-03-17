import { motion } from "motion/react";

import { cn } from "../../lib/utils";

import type { ReactNode } from "react";

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            className={cn(className)}
        >
            {children}
        </motion.div>
    );
}
