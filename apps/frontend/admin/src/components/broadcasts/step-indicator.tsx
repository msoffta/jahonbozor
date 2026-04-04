import { useTranslation } from "react-i18next";

import { Calendar, Check, MessageSquare, Radio, Users } from "lucide-react";

import { cn, motion } from "@jahonbozor/ui";

export function StepIndicator({ currentStep }: { currentStep: number }) {
    const { t } = useTranslation("broadcasts");

    const steps = [
        { label: t("step_send_method"), icon: Radio },
        { label: t("step_recipients"), icon: Users },
        { label: t("step_message"), icon: MessageSquare },
        { label: t("step_schedule"), icon: Calendar },
    ];

    return (
        <div className="flex items-center justify-center gap-2 px-4 py-4 sm:gap-4">
            {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                    <div key={index} className="flex items-center gap-2 sm:gap-4">
                        {index > 0 && (
                            <div
                                className={cn(
                                    "hidden h-px w-6 sm:block sm:w-10",
                                    isCompleted ? "bg-primary" : "bg-muted",
                                )}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                    backgroundColor:
                                        isActive || isCompleted
                                            ? "var(--color-primary)"
                                            : "var(--color-muted)",
                                }}
                                className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                                    isActive || isCompleted
                                        ? "text-primary-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Icon className="h-4 w-4" />
                                )}
                            </motion.div>
                            <span
                                className={cn(
                                    "hidden text-xs sm:block",
                                    isActive
                                        ? "text-foreground font-medium"
                                        : "text-muted-foreground",
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
