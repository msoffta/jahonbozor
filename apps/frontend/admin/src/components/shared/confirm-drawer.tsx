import { useTranslation } from "react-i18next";

import { AlertTriangle } from "lucide-react";

import {
    Button,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    motion,
} from "@jahonbozor/ui";

interface ConfirmDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    isLoading?: boolean;
}

export function ConfirmDrawer({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmLabel,
    isLoading,
}: ConfirmDrawerProps) {
    const { t } = useTranslation();

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{title ?? t("common:confirm_delete")}</DrawerTitle>
                </DrawerHeader>

                <div className="flex flex-col items-center gap-4 px-6 py-4">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full"
                    >
                        <AlertTriangle className="text-destructive h-8 w-8" />
                    </motion.div>
                    <p className="text-muted-foreground text-center text-sm">
                        {description ?? t("common:confirm_delete_description")}
                    </p>
                </div>

                <DrawerFooter>
                    <div className="flex w-full gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {t("common:cancel")}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onConfirm();
                                onOpenChange(false);
                            }}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {confirmLabel ?? t("common:delete")}
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
