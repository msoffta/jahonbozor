import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    Button,
    Input,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@jahonbozor/ui";
import { useForm } from "@tanstack/react-form";
import { CreateStaffBody, CreateStaffForm } from "@jahonbozor/schemas";
import { useTranslation } from "react-i18next";
import { FieldError } from "@/components/forms/field-error";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import { useState } from "react";

interface CreateStaffDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: CreateStaffForm) => Promise<void>;
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
        },
        validators: {
            onSubmit: CreateStaffForm,
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
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    placeholder={t("staff_fullname_placeholder")}
                                />
                                <FieldError field={field} />
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
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    placeholder="ivan_v"
                                />
                                <FieldError field={field} />
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
                                    onChange={(e) =>
                                        field.handleChange(e.target.value)
                                    }
                                    placeholder="••••••••"
                                />
                                <FieldError field={field} />
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
                                    onValueChange={(val) =>
                                        field.handleChange(Number(val))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={t(
                                                "settings:select_role",
                                            )}
                                        ></SelectValue>
                                    </SelectTrigger>

                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem
                                                key={role.id}
                                                value={String(role.id)}
                                                disabled={
                                                    getRoleWeight(role.id) >
                                                    currentUserRoleWeight
                                                }
                                            >
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError field={field} />
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
                                selector={(state) => [
                                    state.canSubmit,
                                    state.isSubmitting,
                                ]}
                                children={([_canSubmit, isSubmitting]) => (
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || isSaving}
                                        className="flex-1"
                                    >
                                        {isSaving || isSubmitting
                                            ? t("common:saving")
                                            : t("common:create")}
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
