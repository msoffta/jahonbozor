import { useTranslation } from "react-i18next";

import { Plus, X } from "lucide-react";

import { Button, Input, motion } from "@jahonbozor/ui";

interface InlineButton {
    text: string;
    url: string;
}

interface InlineButtonBuilderProps {
    buttons: InlineButton[];
    onChange: (buttons: InlineButton[]) => void;
}

export function InlineButtonBuilder({ buttons, onChange }: InlineButtonBuilderProps) {
    const { t } = useTranslation("broadcasts");

    const handleAdd = () => {
        onChange([...buttons, { text: "", url: "" }]);
    };

    const handleRemove = (index: number) => {
        onChange(buttons.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, field: keyof InlineButton, value: string) => {
        const updated = buttons.map((btn, i) => (i === index ? { ...btn, [field]: value } : btn));
        onChange(updated);
    };

    return (
        <div className="space-y-2">
            {buttons.map((button, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2"
                >
                    <Input
                        placeholder={t("button_text")}
                        value={button.text}
                        onChange={(e) => handleChange(index, "text", e.target.value)}
                        className="flex-1"
                    />
                    <Input
                        placeholder={t("button_url")}
                        value={button.url}
                        onChange={(e) => handleChange(index, "url", e.target.value)}
                        className="flex-1"
                    />
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleRemove(index)}
                        className="text-muted-foreground hover:text-destructive mt-2 shrink-0 transition-colors"
                        aria-label={t("remove_button")}
                    >
                        <X className="h-4 w-4" />
                    </motion.button>
                </motion.div>
            ))}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAdd}
                className="w-full"
            >
                <Plus className="mr-1.5 h-4 w-4" />
                {t("add_button")}
            </Button>
        </div>
    );
}
