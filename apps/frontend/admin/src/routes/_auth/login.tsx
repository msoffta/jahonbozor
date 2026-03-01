import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const loginMutation = useLogin();
    const locale = useUIStore((s) => s.locale);
    const setLocale = useUIStore((s) => s.setLocale);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loginMutation.mutate({ username, password });
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
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

            <motion.div variants={fieldVariants}>
                <Input
                    placeholder={t("username")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                />
            </motion.div>

            <motion.div variants={fieldVariants}>
                <Input
                    type="password"
                    placeholder={t("password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                />
            </motion.div>

            <AnimatePresence>
                {loginMutation.isError && (
                    <motion.p
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: [0, -3, 3, -3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm text-red-500 text-center"
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
