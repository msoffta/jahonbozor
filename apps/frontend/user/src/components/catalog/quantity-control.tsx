import { Minus, Plus } from "lucide-react";

import { AnimatePresence, motion } from "@jahonbozor/ui";

interface QuantityControlProps {
    quantity: number;
    onIncrement: () => void;
    onDecrement: () => void;
}

export function QuantityControl({ quantity, onIncrement, onDecrement }: QuantityControlProps) {
    return (
        <div className="bg-accent flex h-11 items-center gap-3 overflow-hidden rounded-xl px-2">
            <motion.button
                type="button"
                onClick={onDecrement}
                className="text-accent-foreground flex size-6 items-center justify-center"
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
                <Minus className="size-3.5" strokeWidth={2} />
            </motion.button>
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={quantity}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="text-accent-foreground w-6 text-center text-base font-medium"
                >
                    {quantity}
                </motion.span>
            </AnimatePresence>
            <motion.button
                type="button"
                onClick={onIncrement}
                className="text-accent-foreground flex size-6 items-center justify-center"
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
                <Plus className="size-3.5" strokeWidth={2} />
            </motion.button>
        </div>
    );
}
