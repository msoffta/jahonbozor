import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerFooter,
	Button,
	Input,
} from "@jahonbozor/ui";
import { useForm } from "@tanstack/react-form";
import { CreateRoleBody } from "@jahonbozor/schemas";
import { useTranslation } from "react-i18next";
import { useState } from "react";

interface CreateRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: CreateRoleBody) => Promise<void>;
}

export function CreateRoleDialog({
	open,
	onOpenChange,
	onSave,
}: CreateRoleDialogProps) {
	const { t } = useTranslation("settings");
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm({
		defaultValues: {
			name: "",
			permissions: [],
		} as CreateRoleBody,
		validators: {
			onSubmit: CreateRoleBody,
		},
		onSubmit: async ({ value }) => {
			setIsSaving(true);
			try {
				await onSave(value);
				form.reset();
				onOpenChange(false);
			} finally {
				setIsSaving(false);
			}
		},
	});

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{t("create_role_title")}</DrawerTitle>
				</DrawerHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-6 px-6 py-4"
				>
					<form.Field
						name="name"
						validators={{
							onBlur: CreateRoleBody.shape.name,
						}}
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									{t("role_name")}
								</label>
								<Input
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Менеджер"
								/>
								{field.state.meta.isTouched && field.state.meta.errors?.length > 0 && (
									<p className="text-xs text-destructive font-medium px-1">
										{field.state.meta.errors.map((err: any) => 
											typeof err === 'object' ? err.message : err
										).join(", ")}
									</p>
								)}
							</div>
						)}
					/>

					<DrawerFooter className="px-0 pt-6">
						<div className="flex gap-3 w-full">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isSaving}
								className="flex-1"
							>
								{t("common:cancel")}
							</Button>
							<form.Subscribe
								selector={(state) => [state.isSubmitting]}
								children={([isSubmitting]) => (
									<Button type="submit" disabled={isSubmitting || isSaving} className="flex-1">
										{isSaving || isSubmitting ? t("common:saving") : t("common:create")}
									</Button>
								)}
							/>
						</div>
					</DrawerFooter>
				</form>
			</DrawerContent>
		</Drawer>
	);
}
