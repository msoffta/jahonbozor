import { useTranslation } from "react-i18next";

import { format } from "date-fns";
import { Loader2, MoreVertical, Phone, Power, RefreshCw, Trash2 } from "lucide-react";

import { Permission } from "@jahonbozor/schemas";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    motion,
} from "@jahonbozor/ui";

import { useDeleteSession, useDisconnectSession, useReconnectSession } from "@/api/sessions.api";
import { useHasPermission } from "@/hooks/use-permissions";

interface TelegramSessionItem {
    id: number;
    name: string;
    phone: string;
    status: string;
    lastUsedAt?: string | null;
}

interface SessionCardProps {
    session: TelegramSessionItem;
}

const STATUS_CONFIG: Record<
    string,
    { variant: "default" | "destructive" | "secondary" | "outline"; className: string }
> = {
    active: {
        variant: "default",
        className:
            "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
    },
    banned: {
        variant: "destructive",
        className: "",
    },
    disconnected: {
        variant: "secondary",
        className:
            "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400",
    },
};

function maskPhone(phone: string): string {
    if (phone.length <= 4) return phone;
    const lastFour = phone.slice(-4);
    const masked = phone.slice(0, -4).replace(/\d/g, "*");
    return masked + lastFour;
}

export function SessionCard({ session }: SessionCardProps) {
    const { t } = useTranslation("broadcasts");

    const canUpdate = useHasPermission(Permission.TELEGRAM_SESSIONS_UPDATE);
    const canDelete = useHasPermission(Permission.TELEGRAM_SESSIONS_DELETE);

    const disconnectSession = useDisconnectSession();
    const reconnectSession = useReconnectSession();
    const deleteSession = useDeleteSession();

    const isActionPending =
        disconnectSession.isPending || reconnectSession.isPending || deleteSession.isPending;

    const statusKey = session.status.toLowerCase();
    const statusConfig = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.disconnected;
    const statusLabel =
        statusKey === "active"
            ? t("session_active")
            : statusKey === "banned"
              ? t("session_banned")
              : t("session_disconnected");

    const hasActions = canUpdate || canDelete;

    return (
        <Card className="relative transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{session.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        variant={statusConfig.variant}
                        className={cn("shrink-0 text-xs", statusConfig.className)}
                    >
                        {statusLabel}
                    </Badge>
                    {hasActions && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <motion.div whileTap={{ scale: 0.95 }}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        disabled={isActionPending}
                                    >
                                        {isActionPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <MoreVertical className="h-4 w-4" />
                                        )}
                                    </Button>
                                </motion.div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {canUpdate && statusKey === "active" && (
                                    <DropdownMenuItem
                                        onClick={() => disconnectSession.mutate(session.id)}
                                    >
                                        <Power className="mr-2 h-4 w-4" />
                                        {t("session_disconnect")}
                                    </DropdownMenuItem>
                                )}
                                {canUpdate && statusKey === "disconnected" && (
                                    <DropdownMenuItem
                                        onClick={() => reconnectSession.mutate(session.id)}
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        {t("session_reconnect")}
                                    </DropdownMenuItem>
                                )}
                                {canDelete && (
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => deleteSession.mutate(session.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {t("session_delete")}
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="font-mono">{maskPhone(session.phone)}</span>
                </div>
                {session.lastUsedAt && (
                    <p className="text-muted-foreground text-xs">
                        {t("session_last_active")}:{" "}
                        {format(new Date(session.lastUsedAt), "dd.MM.yyyy HH:mm")}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export type { TelegramSessionItem };
