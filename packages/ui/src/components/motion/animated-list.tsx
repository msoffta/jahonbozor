import { motion } from "motion/react";

import { cn } from "../../lib/utils";

import type { ReactNode } from "react";

const containerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.04,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 25 },
    },
};

interface AnimatedListProps {
    children: ReactNode;
    className?: string;
}

function AnimatedList({ children, className }: AnimatedListProps) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn(className)}
        >
            {children}
        </motion.div>
    );
}

function AnimatedListItem({ children, className }: AnimatedListProps) {
    return (
        <motion.div variants={itemVariants} className={cn(className)}>
            {children}
        </motion.div>
    );
}

export { AnimatedList, AnimatedListItem };
