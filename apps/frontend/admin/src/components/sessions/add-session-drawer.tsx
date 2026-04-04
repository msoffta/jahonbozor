import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PatternFormat } from "react-number-format";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";

import {
    AnimatePresence,
    Button,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    Input,
    motion,
} from "@jahonbozor/ui";

import { qrStatusQueryOptions, useStartQrLogin, useSubmitQrPassword } from "@/api/sessions.api";

interface AddSessionDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Step = "form" | "scanning" | "password" | "success";

interface FormState {
    name: string;
    phone: string;
}

interface FormErrors {
    name?: string;
    phone?: string;
}

const AUTO_CLOSE_DELAY_MS = 2000;

const stepVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

export function AddSessionDrawer({ open, onOpenChange }: AddSessionDrawerProps) {
    const { t } = useTranslation("broadcasts");

    const [step, setStep] = useState<Step>("form");
    const [form, setForm] = useState<FormState>({
        name: "",
        phone: "",
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [qrToken, setQrToken] = useState("");
    const [qrUrl, setQrUrl] = useState("");
    const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [password, setPassword] = useState("");

    const startQrLogin = useStartQrLogin();
    const submitPassword = useSubmitQrPassword();

    const isPolling = (step === "scanning" || step === "password") && !!qrToken;

    const { data: qrStatus } = useQuery(qrStatusQueryOptions(qrToken, isPolling));

    // Watch for QR scan completion / 2FA
    useEffect(() => {
        if (!qrStatus) return;
        if (qrStatus.status === "authenticated") {
            queueMicrotask(() => setStep("success"));
        } else if (qrStatus.status === "needs_password" && step === "scanning") {
            queueMicrotask(() => setStep("password"));
        } else if (qrStatus.status === "expired" && step !== "form") {
            queueMicrotask(() => setStep("form"));
        }
    }, [qrStatus?.status, step]);

    // Auto-close after success
    useEffect(() => {
        if (step === "success") {
            autoCloseTimerRef.current = setTimeout(() => {
                onOpenChange(false);
            }, AUTO_CLOSE_DELAY_MS);
        }
        return () => {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
                autoCloseTimerRef.current = null;
            }
        };
    }, [step, onOpenChange]);

    const resetState = useCallback(() => {
        setStep("form");
        setForm({ name: "", phone: "" });
        setErrors({});
        setQrToken("");
        setQrUrl("");
        setPassword("");
        startQrLogin.reset();
    }, [startQrLogin]);

    const handleClose = useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen) resetState();
            onOpenChange(nextOpen);
        },
        [onOpenChange, resetState],
    );

    const validate = useCallback((): boolean => {
        const newErrors: FormErrors = {};
        if (!form.name.trim()) {
            newErrors.name = t("common:required");
        }
        if (!form.phone.trim()) {
            newErrors.phone = t("common:required");
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [form, t]);

    const handleConnect = useCallback(() => {
        if (!validate()) return;

        startQrLogin.mutate(
            {
                name: form.name.trim(),
                phone: form.phone.startsWith("+") ? form.phone : `+${form.phone}`,
            },
            {
                onSuccess: (result) => {
                    setQrUrl(result.qrUrl);
                    setQrToken(result.token);
                    setStep("scanning");
                },
            },
        );
    }, [form, validate, startQrLogin]);

    const handleSubmitPassword = useCallback(() => {
        if (!password.trim()) return;
        submitPassword.mutate(
            { token: qrToken, password: password.trim() },
            { onSuccess: () => setStep("scanning") },
        );
    }, [password, qrToken, submitPassword]);

    const handleRetryQr = useCallback(() => {
        startQrLogin.mutate(
            {
                name: form.name.trim(),
                phone: form.phone.startsWith("+") ? form.phone : `+${form.phone}`,
            },
            {
                onSuccess: (result) => {
                    setQrUrl(result.qrUrl);
                    setQrToken(result.token);
                    setStep("scanning");
                },
            },
        );
    }, [form, startQrLogin]);

    const updateField = useCallback(
        (field: keyof FormState, value: string) => {
            setForm((prev) => ({ ...prev, [field]: value }));
            if (errors[field]) {
                setErrors((prev) => ({ ...prev, [field]: undefined }));
            }
        },
        [errors],
    );

    return (
        <Drawer open={open} onOpenChange={handleClose}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{t("qr_title")}</DrawerTitle>
                </DrawerHeader>

                <div className="px-4 pb-2">
                    <AnimatePresence mode="wait">
                        {step === "form" && (
                            <motion.div
                                key="form"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col gap-4"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleConnect();
                                    }
                                }}
                            >
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">
                                        {t("session_name")}
                                    </label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => updateField("name", e.target.value)}
                                        placeholder={t("session_name")}
                                    />
                                    {errors.name && (
                                        <p className="text-destructive text-xs">{errors.name}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">
                                        {t("session_phone")}
                                    </label>
                                    <PatternFormat
                                        format="+### ## ### ## ##"
                                        allowEmptyFormatting
                                        mask="_"
                                        value={form.phone}
                                        onValueChange={(values) =>
                                            updateField("phone", values.value)
                                        }
                                        customInput={Input}
                                        placeholder="+998 90 123 45 67"
                                    />
                                    {errors.phone && (
                                        <p className="text-destructive text-xs">{errors.phone}</p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {step === "scanning" && (
                            <motion.div
                                key="scanning"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col items-center gap-4 py-4"
                            >
                                <p className="text-muted-foreground text-center text-sm">
                                    {t("qr_scan_instruction")}
                                </p>

                                {qrUrl && (
                                    <div className="bg-background overflow-hidden rounded-xl border p-2">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=256x256`}
                                            alt="QR Code"
                                            className="h-64 w-64"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <Loader2 className="text-primary h-4 w-4 animate-spin" />
                                    <p className="text-muted-foreground text-sm">
                                        {t("qr_waiting")}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {step === "password" && (
                            <motion.div
                                key="password"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col items-center gap-4 py-4"
                            >
                                <p className="text-sm font-medium">{t("qr_2fa_title")}</p>
                                <p className="text-muted-foreground text-center text-xs">
                                    {t("qr_2fa_description")}
                                </p>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t("qr_2fa_placeholder")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSubmitPassword();
                                    }}
                                />
                            </motion.div>
                        )}

                        {step === "success" && (
                            <motion.div
                                key="success"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col items-center gap-4 py-10"
                            >
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 17,
                                    }}
                                >
                                    <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                                </motion.div>
                                <p className="text-lg font-semibold">{t("qr_success")}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DrawerFooter>
                    {step === "form" && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleClose(false)}
                                className="flex-1"
                            >
                                {t("cancel")}
                            </Button>
                            <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
                                <Button
                                    onClick={handleConnect}
                                    disabled={startQrLogin.isPending}
                                    className="w-full"
                                >
                                    {startQrLogin.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {t("next")}
                                </Button>
                            </motion.div>
                        </div>
                    )}

                    {step === "scanning" && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleRetryQr}
                                disabled={startQrLogin.isPending}
                                className="flex-1"
                            >
                                {t("qr_retry")}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleClose(false)}
                                className="flex-1"
                            >
                                {t("cancel")}
                            </Button>
                        </div>
                    )}

                    {step === "password" && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleClose(false)}
                                className="flex-1"
                            >
                                {t("cancel")}
                            </Button>
                            <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
                                <Button
                                    onClick={handleSubmitPassword}
                                    disabled={!password.trim() || submitPassword.isPending}
                                    className="w-full"
                                >
                                    {submitPassword.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {t("send")}
                                </Button>
                            </motion.div>
                        </div>
                    )}

                    {step === "success" && (
                        <Button onClick={() => handleClose(false)}>
                            {t("common:close", t("cancel"))}
                        </Button>
                    )}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
