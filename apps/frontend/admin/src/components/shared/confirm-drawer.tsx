import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerFooter,
	Button,
	motion,
} from "@jahonbozor/ui";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

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
						className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<AlertTriangle className="h-8 w-8 text-destructive" />
					</motion.div>
					<p className="text-center text-sm text-muted-foreground">
						{description ?? t("common:confirm_delete_description")}
					</p>
				</div>

				<DrawerFooter>
					<div className="flex gap-3 w-full">
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
