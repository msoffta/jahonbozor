import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { motion } from "@jahonbozor/ui";

interface SearchBarProps {
    value?: string;
    onChange: (query: string) => void;
}

export function SearchBar({ value = "", onChange }: SearchBarProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState(value);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, onChange]);

    return (
        <div className="px-4 py-2">
            <motion.div
                className="h-10 px-2.5 rounded-2xl border border-muted-foreground flex items-center gap-2.5"
                animate={{
                    borderColor: focused ? "var(--color-accent)" : "var(--color-muted-foreground)",
                    scale: focused ? 1.02 : 1,
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
                <motion.span
                    className="shrink-0"
                    animate={{ color: focused ? "var(--color-accent)" : "var(--color-muted-foreground)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                    <Search className="h-5 w-5" />
                </motion.span>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={t("search")}
                    className="w-full h-10 bg-transparent text-base font-semibold text-foreground placeholder:text-foreground/40 outline-none"
                />
            </motion.div>
        </div>
    );
}
