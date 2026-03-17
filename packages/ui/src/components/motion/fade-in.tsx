import { motion } from "motion/react";

import { cn } from "../../lib/utils";

import type { ReactNode } from "react";

interface FadeInProps {
    children: ReactNode;
    className?: string;
    delay?: number;
}

export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay }}
            className={cn(className)}
        >
            {children}
        </motion.div>
    );
}
