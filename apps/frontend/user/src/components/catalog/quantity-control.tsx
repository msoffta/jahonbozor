import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "@jahonbozor/ui";

interface QuantityControlProps {
    quantity: number;
    onIncrement: () => void;
    onDecrement: () => void;
}

export function QuantityControl({ quantity, onIncrement, onDecrement }: QuantityControlProps) {
    return (
        <div className="flex h-11 items-center gap-3 bg-accent rounded-xl px-2 overflow-hidden">
            <motion.button
                type="button"
                onClick={onDecrement}
                className="flex size-6 items-center justify-center text-accent-foreground"
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
                    className="w-6 text-center text-base font-medium text-accent-foreground"
                >
                    {quantity}
                </motion.span>
            </AnimatePresence>
            <motion.button
                type="button"
                onClick={onIncrement}
                className="flex size-6 items-center justify-center text-accent-foreground"
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
                <Plus className="size-3.5" strokeWidth={2} />
            </motion.button>
        </div>
    );
}
