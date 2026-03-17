import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "@tanstack/react-form";
import { SignInBody } from "@jahonbozor/schemas";
import { Loader2 } from "lucide-react";
import { Button, Input, cn, motion, AnimatePresence } from "@jahonbozor/ui";
import { useLogin } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

const formVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06 },
    },
};

const fieldVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 25 },
    },
};

function LoginPage() {
    const { t } = useTranslation();
    const loginMutation = useLogin();
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);

    const form = useForm({
        defaultValues: {
            username: "",
            password: "",
        },
        validators: {
            onSubmit: SignInBody,
        },
        onSubmit: async ({ value }) => {
            loginMutation.mutate(value);
        },
    });

    return (
        <motion.form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
            }}
            className="w-full max-w-sm space-y-4 p-6"
            variants={formVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={fieldVariants}>
                <h1 className="text-center text-2xl font-bold">
                    {t("app_name")}
                </h1>
            </motion.div>

            <motion.div variants={fieldVariants} className="flex gap-3">
                <motion.button
                    type="button"
                    onClick={() => setLocale("uz")}
                    className={cn(
                        "flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors",
                        locale === "uz"
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                    )}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("uzbek")}
                </motion.button>
                <motion.button
                    type="button"
                    onClick={() => setLocale("ru")}
                    className={cn(
                        "flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors",
                        locale === "ru"
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                    )}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    {t("russian")}
                </motion.button>
            </motion.div>

            <form.Field
                name="username"
                validators={{
                    onBlur: SignInBody.shape.username,
                }}
                children={(field) => (
                    <motion.div variants={fieldVariants}>
                        <Input
                            placeholder={t("username")}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            autoComplete="username"
                        />
                        {field.state.meta.isTouched &&
                            field.state.meta.errors?.length > 0 && (
                                <p className="text-xs text-destructive font-medium px-1 mt-1">
                                    {field.state.meta.errors
                                        .map((err: unknown) =>
                                            typeof err === "object" && err !== null && "message" in err
                                                ? (err as { message: string }).message
                                                : String(err),
                                        )
                                        .join(", ")}
                                </p>
                            )}
                    </motion.div>
                )}
            />

            <form.Field
                name="password"
                validators={{
                    onBlur: SignInBody.shape.password,
                }}
                children={(field) => (
                    <motion.div variants={fieldVariants}>
                        <Input
                            type="password"
                            placeholder={t("password")}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            autoComplete="current-password"
                        />
                        {field.state.meta.isTouched &&
                            field.state.meta.errors?.length > 0 && (
                                <p className="text-xs text-destructive font-medium px-1 mt-1">
                                    {field.state.meta.errors
                                        .map((err: unknown) =>
                                            typeof err === "object" && err !== null && "message" in err
                                                ? (err as { message: string }).message
                                                : String(err),
                                        )
                                        .join(", ")}
                                </p>
                            )}
                    </motion.div>
                )}
            />

            <AnimatePresence>
                {loginMutation.isError && (
                    <motion.p
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: [0, -3, 3, -3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm text-destructive text-center"
                    >
                        {t("login_error")}
                    </motion.p>
                )}
            </AnimatePresence>

            <motion.div variants={fieldVariants}>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    <AnimatePresence mode="wait" initial={false}>
                        {loginMutation.isPending ? (
                            <motion.span
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="flex items-center gap-2"
                            >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("loading")}
                            </motion.span>
                        ) : (
                            <motion.span
                                key="login"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            >
                                {t("login")}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Button>
            </motion.div>
        </motion.form>
    );
}

export const Route = createFileRoute("/_auth/login")({
    beforeLoad: () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
            throw redirect({ to: "/" });
        }
    },
    component: LoginPage,
});
