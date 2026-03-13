import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerFooter,
	Button,
	Input,
	Select,
} from "@jahonbozor/ui";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { CreateStaffBody } from "@jahonbozor/schemas";
import { useTranslation } from "react-i18next";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import { useState } from "react";

interface CreateStaffDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: CreateStaffBody) => Promise<void>;
	roles: RoleItem[];
	currentUserRoleWeight: number;
	getRoleWeight: (roleId: number) => number;
}

export function CreateStaffDialog({
	open,
	onOpenChange,
	onSave,
	roles,
	currentUserRoleWeight,
	getRoleWeight,
}: CreateStaffDialogProps) {
	const { t } = useTranslation("settings");
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm({
		defaultValues: {
			fullname: "",
			username: "",
			password: "",
			roleId: 0,
			telegramId: null as string | null,
		} as CreateStaffBody,
		validatorAdapter: zodValidator(),
		validators: {
			onSubmit: CreateStaffBody,
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
					<DrawerTitle>{t("create_staff_title")}</DrawerTitle>
				</DrawerHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-5 px-6 py-4"
				>
					<form.Field
						name="fullname"
						validators={{
							onBlur: CreateStaffBody.shape.fullname,
						}}
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									{t("staff_fullname")}
								</label>
								<Input
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Иван Иванов"
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

					<form.Field
						name="username"
						validators={{
							onBlur: CreateStaffBody.shape.username,
						}}
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									{t("staff_username")}
								</label>
								<Input
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="ivan_v"
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

					<form.Field
						name="password"
						validators={{
							onBlur: CreateStaffBody.shape.password,
						}}
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									{t("staff_password")}
								</label>
								<Input
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="••••••••"
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

					<form.Field
						name="roleId"
						validators={{
							onBlur: CreateStaffBody.shape.roleId,
						}}
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									{t("staff_role")}
								</label>
								<Select
									value={String(field.state.value || "")}
									onValueChange={(val) => field.handleChange(Number(val))}
									options={roles.map((role) => ({
										label: role.name,
										value: String(role.id),
										disabled: getRoleWeight(role.id) > currentUserRoleWeight,
									}))}
									placeholder={t("common:select_placeholder")}
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

					<form.Field
						name="telegramId"
						children={(field) => (
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-semibold text-foreground/70 px-0.5 block">
									Telegram ID
								</label>
								<Input
									value={(field.state.value as string) || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value || null)}
									placeholder="123456789"
								/>
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
								selector={(state) => [state.canSubmit, state.isSubmitting]}
								children={([canSubmit, isSubmitting]) => (
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
