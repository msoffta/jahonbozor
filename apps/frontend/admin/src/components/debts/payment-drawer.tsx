import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Banknote } from "lucide-react";

import {
    Button,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    Input,
    motion,
} from "@jahonbozor/ui";

import { useCreateDebtPayment } from "@/api/debts.api";

interface PaymentDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: number;
    remainingAmount?: number;
}

export function PaymentDrawer({
    open,
    onOpenChange,
    orderId,
    remainingAmount,
}: PaymentDrawerProps) {
    const { t } = useTranslation("clients");
    const [amount, setAmount] = useState("");
    const [comment, setComment] = useState("");
    const createPayment = useCreateDebtPayment();

    const handleSubmit = () => {
        const numericAmount = Number(amount);
        if (numericAmount <= 0) return;

        createPayment.mutate(
            { orderId, amount: numericAmount, comment: comment || null },
            {
                onSuccess: () => {
                    setAmount("");
                    setComment("");
                    onOpenChange(false);
                },
            },
        );
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{t("debt_record_payment")}</DrawerTitle>
                </DrawerHeader>

                <div className="flex flex-col items-center gap-4 px-6 py-4">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                        <Banknote className="h-8 w-8 text-emerald-600" />
                    </motion.div>

                    {remainingAmount !== undefined && (
                        <p className="text-muted-foreground text-sm">
                            {t("debt_remaining")}: {remainingAmount.toLocaleString()}
                        </p>
                    )}

                    <div className="w-full space-y-3">
                        <Input
                            type="number"
                            placeholder={t("debt_payment_amount")}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min={1}
                            autoFocus
                        />
                        <Input
                            placeholder={t("debt_payment_comment")}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>
                </div>

                <DrawerFooter>
                    <div className="flex w-full gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={createPayment.isPending}
                            className="flex-1"
                        >
                            {t("common:cancel")}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={createPayment.isPending || Number(amount) <= 0}
                            className="flex-1"
                        >
                            {t("debt_confirm_payment")}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
