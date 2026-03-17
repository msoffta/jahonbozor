import { clientsListQueryOptions } from "@/api/clients.api";
import { AnimatePresence, Input, motion } from "@jahonbozor/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, User, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrderDialog({
    open,
    onOpenChange,
}: CreateOrderDialogProps) {
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
                client.fullname.toLowerCase().includes(query) ||
                (client.phone && client.phone.includes(query)),
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
        navigate({ to: "/users", search: { new: true } });
    }

    function handleSelectClient(userId: number) {
        handleClose();
        navigate({ to: "/orders/new", search: { userId } });
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
                            className="relative w-full max-w-md rounded-2xl bg-background shadow-xl"
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
                                    <h2 className="text-lg font-semibold">
                                        {t("select_client")}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {t("select_client_description")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="px-5 pb-3">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder={t("search_client")}
                                        value={searchQuery}
                                        onChange={(event) =>
                                            setSearchQuery(event.target.value)
                                        }
                                        className="pl-9"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Client list */}
                            <div
                                className="flex flex-col gap-1 overflow-y-auto px-5 pb-5 max-h-[50vh]"
                            >
                                {/* Create new client */}
                                <motion.button
                                    type="button"
                                    className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/30 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                                    onClick={handleCreateNewClient}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 17,
                                    }}
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <UserPlus className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-primary">
                                        {t("create_new_client")}
                                    </span>
                                </motion.button>

                                {/* Loading */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {filtered.map((client) => (
                                            <motion.button
                                                key={client.id}
                                                type="button"
                                                className="flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent"
                                                onClick={() =>
                                                    handleSelectClient(
                                                        client.id,
                                                    )
                                                }
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
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {client.fullname}
                                                    </span>
                                                    {client.phone && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {client.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.button>
                                        ))}
                                        {filtered.length === 0 &&
                                            !isLoading && (
                                                <p className="py-6 text-center text-sm text-muted-foreground">
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
