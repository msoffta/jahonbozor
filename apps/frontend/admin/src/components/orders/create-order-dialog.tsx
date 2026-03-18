import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, User, UserPlus, X } from "lucide-react";

import { AnimatePresence, Input, motion } from "@jahonbozor/ui";

import { clientsListQueryOptions } from "@/api/clients.api";

interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: clientsData, isLoading } = useQuery(
        clientsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const clients = clientsData?.users ?? [];

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return clients;
        const query = searchQuery.toLowerCase();
        return clients.filter(
            (client) =>
                client.fullname.toLowerCase().includes(query) || client.phone?.includes(query),
        );
    }, [clients, searchQuery]);

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    function handleClose() {
        onOpenChange(false);
        setSearchQuery("");
    }

    function handleCreateNewClient() {
        handleClose();
        void navigate({ to: "/users", search: { new: true } });
    }

    function handleSelectClient(userId: number) {
        handleClose();
        void navigate({ to: "/orders/new", search: { userId } });
    }

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop + centered container */}
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleClose}
                    >
                        <motion.div
                            className="bg-background relative w-full max-w-md rounded-2xl shadow-xl"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 25,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pt-5 pb-2">
                                <div>
                                    <h2 className="text-lg font-semibold">{t("select_client")}</h2>
                                    <p className="text-muted-foreground text-sm">
                                        {t("select_client_description")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-5 pb-3">
                                <div className="relative">
                                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        placeholder={t("search_client")}
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        className="pl-9"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Client list */}
                            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto px-5 pb-5">
                                {/* Create new client */}
                                <motion.button
                                    type="button"
                                    className="border-primary/30 hover:border-primary hover:bg-primary/5 flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-left transition-colors"
                                    onClick={handleCreateNewClient}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 17,
                                    }}
                                >
                                    <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
                                        <UserPlus className="h-4 w-4" />
                                    </div>
                                    <span className="text-primary font-medium">
                                        {t("create_new_client")}
                                    </span>
                                </motion.button>

                                {/* Loading */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                                    </div>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filtered.map((client) => (
                                            <motion.button
                                                key={client.id}
                                                type="button"
                                                className="hover:bg-accent flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors"
                                                onClick={() => handleSelectClient(client.id)}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 17,
                                                }}
                                                layout
                                            >
                                                <div className="bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {client.fullname}
                                                    </span>
                                                    {client.phone && (
                                                        <span className="text-muted-foreground text-xs">
                                                            {client.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.button>
                                        ))}
                                        {filtered.length === 0 && !isLoading && (
                                            <p className="text-muted-foreground py-6 text-center text-sm">
                                                {t("lists_empty")}
                                            </p>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
