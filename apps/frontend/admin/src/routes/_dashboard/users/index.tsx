import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import z from "zod";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Checkbox,
    DataTable,
    DataTableSkeleton,
    motion,
    PageTransition,
    useIsMobile,
} from "@jahonbozor/ui";

import {
    clientsInfiniteQueryOptions,
    useCreateClient,
    useDeleteClient,
    useRestoreClient,
    useUpdateClient,
} from "@/api/clients.api";
import { getClientColumns } from "@/components/clients/clients-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { useHasPermission } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";

const usersSearchSchema = z.object({
    new: z.boolean().optional(),
    returnTo: z.string().optional(),
});

function UsersPage() {
    const { t } = useTranslation("clients");
    const navigate = useNavigate();
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { new: isNew, returnTo } = Route.useSearch();
    const isReady = useDeferredReady();
    const translations = useDataTableTranslations(t("clients_empty"));

    // Permission checks for component-level actions
    const canCreate = useHasPermission(Permission.USERS_CREATE);
    const canUpdate = useHasPermission(Permission.USERS_UPDATE_ALL);
    const canDelete = useHasPermission(Permission.USERS_DELETE);

    const {
        data: clientsData,
        isLoading: isClientsLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        clientsInfiniteQueryOptions({
            includeDeleted,
            searchQuery,
        }),
    );

    const createClient = useCreateClient();
    const updateClient = useUpdateClient();
    const deleteClient = useDeleteClient();
    const restoreClient = useRestoreClient();

    const loadingRowIds = useMemo(() => {
        const ids = new Set<number>();
        if (updateClient.isPending && updateClient.variables?.id)
            ids.add(updateClient.variables.id);
        if (deleteClient.isPending && deleteClient.variables) ids.add(deleteClient.variables);
        if (restoreClient.isPending && restoreClient.variables) ids.add(restoreClient.variables);
        return ids;
    }, [
        updateClient.isPending,
        updateClient.variables,
        deleteClient.isPending,
        deleteClient.variables,
        restoreClient.isPending,
        restoreClient.variables,
    ]);

    const isLoading = isClientsLoading || !isReady;

    useEffect(() => {
        if (isNew && !isLoading) {
            // Wait for DOM to render
            setTimeout(() => {
                const newRow = document.getElementById("new-row");
                if (newRow) {
                    newRow.scrollIntoView({ behavior: "smooth", block: "center" });
                    // Optional: find first input and focus it
                    const firstInput = newRow.querySelector("input");
                    if (firstInput) firstInput.focus();
                }
            }, 100);
        }
    }, [isNew, isLoading]);

    const actions = useMemo(
        () => ({
            onDelete: (id: number) => deleteClient.mutate(id),
            onRestore: (id: number) => restoreClient.mutate(id),
        }),
        [deleteClient, restoreClient],
    );

    const columns = useMemo(
        () => getClientColumns(t, actions, { canDelete }),
        [t, actions, canDelete],
    );

    const clients = useMemo(() => {
        const all = clientsData?.pages.flatMap((p) => p.users) ?? [];
        if (includeDeleted) return all.filter((u) => u.deletedAt != null);
        return all;
    }, [clientsData, includeDeleted]);
    const totalCount = clientsData?.pages[0]?.count ?? 0;

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { username: false, language: false, status: false, createdAt: false } : {},
        [isMobile],
    );

    const handleCellEdit = useCallback(
        async (rowIndex: number, columnId: string, value: unknown) => {
            const client = clients[rowIndex];
            if (!client) return;

            const body: Record<string, unknown> = {};
            body[columnId] = value;

            updateClient.mutate({ id: client.id, ...body });
        },
        [clients, updateClient],
    );

    const handleNewRowSave = useCallback(
        async (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            // If already linked, update any field
            if (linkedId) {
                const body: Record<string, unknown> = {};
                if (data.fullname != null) body.fullname = String(data.fullname as string);
                if (data.username != null) body.username = String(data.username as string);
                if (data.phone !== undefined) body.phone = String(data.phone as string) || null;
                if (data.language) body.language = data.language;

                const result = await updateClient.mutateAsync({
                    id: linkedId as number,
                    ...body,
                });
                return result?.id;
            }

            // For initial creation, fullname and username are strictly required
            if (!data.fullname || !data.username) {
                return; // Wait for essential data
            }

            const result = await createClient.mutateAsync({
                fullname: String(data.fullname as string),
                username: String(data.username as string),
                phone: data.phone != null ? String(data.phone as string) : null,
                telegramId: null,
                photo: null,
                language: data.language === "ru" ? "ru" : "uz",
            });

            if (result?.id && returnTo === "orders") {
                void navigate({ to: "/orders/new", search: { userId: result.id } });
            }

            return result?.id;
        },
        [createClient, updateClient, navigate, returnTo],
    );

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-3 md:p-6">
            <div className="mb-4 flex items-center justify-between md:mb-6">
                <h1 className="text-xl font-bold md:text-2xl">{t("title")}</h1>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                        checked={includeDeleted}
                        onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                    />
                    {t("common:show_deleted")}
                </label>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={8} rows={10} className="flex-1" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <DataTable
                            className="flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={clients}
                            enableInfiniteScroll
                            onFetchNextPage={fetchNextPage}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            totalCount={totalCount}
                            enableSorting
                            enableGlobalSearch
                            onSearchQueryChange={setSearchQuery}
                            enableFiltering
                            enableColumnVisibility
                            enableColumnResizing
                            enableEditing={canUpdate}
                            enableMultipleNewRows={canCreate}
                            multiRowCount={50}
                            multiRowMaxCount={50}
                            onCellEdit={handleCellEdit}
                            onMultiRowSave={handleNewRowSave}
                            loadingRowIds={loadingRowIds}
                            translations={translations}
                            onRowClick={(row) =>
                                void navigate({
                                    to: "/users/$userId",
                                    params: { userId: String(row.id) },
                                })
                            }
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/users/")({
    validateSearch: (search) => usersSearchSchema.parse(search),
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.USERS_LIST)) {
            throw redirect({ to: "/" });
        }
    },
    component: UsersPage,
});
