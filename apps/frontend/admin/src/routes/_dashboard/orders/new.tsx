import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, Save } from "lucide-react";
import z from "zod";

import { hasPermission, Permission } from "@jahonbozor/schemas";
import {
    AnimatePresence,
    Button,
    DataTable,
    DataTableSkeleton,
    Input,
    motion,
    PageTransition,
    toast,
    useIsMobile,
} from "@jahonbozor/ui";

import { clientDetailQueryOptions } from "@/api/clients.api";
import { useCreateOrder } from "@/api/orders.api";
import { productsListQueryOptions, searchProductsFn } from "@/api/products.api";
import { getOrderItemColumns } from "@/components/orders/order-items-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";

import type { DataTableRef } from "@jahonbozor/ui";

const newOrderSearchSchema = z.object({
    userId: z.coerce.number().optional(),
});

interface LocalItem {
    id: number;
    productId: number | null;
    quantity: number;
    price: number;
    product: {
        id: number;
        name: string;
        price?: number;
        remaining?: number;
        costprice?: number;
    } | null;
}

function NewOrderPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const translations = useDataTableTranslations(t("no_items"));
    const { userId } = Route.useSearch();

    const tableRef = useRef<DataTableRef>(null);
    const [items, setItems] = useState<LocalItem[]>([]);
    const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT_CARD" | "DEBT">("CASH");
    const [comment, setComment] = useState("");

    const { data: clientData } = useQuery(clientDetailQueryOptions(userId ?? 0));

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 10000, includeDeleted: false }),
    );

    const createOrder = useCreateOrder();
    const products = productsData?.products ?? [];

    const handleDeleteItem = useCallback((index: number) => {
        setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    }, []);

    const columns = useMemo(
        () =>
            getOrderItemColumns(t, products, {
                onDelete: handleDeleteItem,
                onSearchProducts: searchProductsFn,
            }),
        [t, products, handleDeleteItem],
    );

    const isMobile = useIsMobile();
    const initialColumnVisibility = useMemo(
        (): Record<string, boolean> =>
            isMobile ? { price: false, remaining: false, costprice: false } : {},
        [isMobile],
    );

    const newRowDefaultValues = useMemo(() => ({}), []);

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>, _rowId: string) => {
            const currentQuantity = Number(values.quantity) || 0;

            if (values.product) {
                const productId = Number(values.product);
                const product = products.find((p) => p.id === productId);
                const price = product?.price ?? 0;
                const remaining = product?.remaining ?? 0;
                const costprice = product?.costprice ?? 0;
                const newTotal = price * currentQuantity;

                return {
                    ...values,
                    price,
                    remaining,
                    costprice,
                    quantity: currentQuantity,
                    total: newTotal,
                };
            }

            const price = Number(values.price) || 0;
            const newTotal = price * currentQuantity;
            return { ...values, quantity: currentQuantity, total: newTotal };
        },
        [products],
    );

    const handleNewRowSave = useCallback(
        (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            const productId = data.product ? Number(data.product) : null;
            const product =
                productId != null ? (products.find((p) => p.id === productId) ?? null) : null;

            const userPrice =
                data.price != null && data.price !== ""
                    ? Number(data.price)
                    : (product?.price ?? 0);

            if (linkedId) {
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === linkedId
                            ? {
                                  ...item,
                                  productId,
                                  quantity: Number(data.quantity) || 0,
                                  price: userPrice,
                                  product: product
                                      ? {
                                            id: product.id,
                                            name: product.name,
                                            price: product.price,
                                            remaining: product.remaining,
                                            costprice: product.costprice,
                                        }
                                      : null,
                              }
                            : item,
                    ),
                );
                return linkedId;
            }

            const newId = Date.now() + Math.round(performance.now() * 1000);
            const newItem: LocalItem = {
                id: newId,
                productId,
                quantity: Number(data.quantity) || 0,
                price: userPrice,
                product: product
                    ? {
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          remaining: product.remaining,
                          costprice: product.costprice,
                      }
                    : null,
            };

            setItems((prev) => [...prev, newItem]);
            return newId;
        },
        [products],
    );

    const handleCellEdit = useCallback(
        (rowIndex: number, columnId: string, value: unknown) => {
            if (columnId === "product") {
                const productId = Number(value);
                const product = products.find((p) => p.id === productId);
                if (!product) return;
                setItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex
                            ? {
                                  ...item,
                                  productId,
                                  price: product.price,
                                  product: {
                                      id: product.id,
                                      name: product.name,
                                      price: product.price,
                                      remaining: product.remaining,
                                      costprice: product.costprice,
                                  },
                              }
                            : item,
                    ),
                );
            } else if (columnId === "quantity") {
                setItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex ? { ...item, quantity: Number(value) || 0 } : item,
                    ),
                );
            } else if (columnId === "price") {
                setItems((prev) =>
                    prev.map((item, i) =>
                        i === rowIndex ? { ...item, price: Number(value) || 0 } : item,
                    ),
                );
            } else if (columnId === "total") {
                const newTotal = Number(value) || 0;
                setItems((prev) =>
                    prev.map((item, i) => {
                        if (i !== rowIndex) return item;
                        const newPrice =
                            item.quantity > 0 ? Math.round(newTotal / item.quantity) : newTotal;
                        return { ...item, price: newPrice };
                    }),
                );
            }
        },
        [products],
    );

    async function handleSaveList() {
        await tableRef.current?.flushPendingRows();

        if (items.length < 1) {
            toast.error(t("min_items_required"));
            return;
        }

        if (paymentType === "DEBT" && !userId) {
            toast.error(t("error_debt_requires_user"));
            return;
        }

        createOrder.mutate(
            {
                userId: userId ?? null,
                paymentType,
                comment: comment.trim() || null,
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
            {
                onSuccess: (order) => {
                    void navigate({
                        to: "/orders/$orderId",
                        params: { orderId: String(order.id) },
                    });
                },
            },
        );
    }

    async function handleSaveDraft() {
        await tableRef.current?.flushPendingRows();

        createOrder.mutate(
            {
                userId: userId ?? null,
                paymentType,
                status: "DRAFT",
                comment: comment.trim() || null,
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
            {
                onSuccess: (order) => {
                    toast.success(t("draft_saved"));
                    void navigate({
                        to: "/orders/$orderId",
                        params: { orderId: String(order.id) },
                    });
                },
            },
        );
    }

    const totalSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-2 md:p-4">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <motion.button
                        type="button"
                        onClick={() => navigate({ to: "/orders" })}
                        className="border-border text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        whileTap={{ scale: 0.9 }}
                        aria-label={t("common:back")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                    <div>
                        <h1 className="text-xl font-bold md:text-2xl">{t("lists_title")}</h1>
                        {clientData && (
                            <p className="text-muted-foreground text-sm">
                                {t("order_client")}: {clientData.fullname}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <Input
                        placeholder={t("order_comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="h-9 w-full text-sm sm:w-48"
                    />

                    {/* Payment type toggle */}
                    <div className="border-border flex overflow-hidden rounded-lg border">
                        <motion.button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium ${paymentType === "CASH" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() => setPaymentType("CASH")}
                            whileTap={{ scale: 0.95 }}
                        >
                            {t("payment_cash")}
                        </motion.button>
                        <motion.button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium ${paymentType === "CREDIT_CARD" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() => setPaymentType("CREDIT_CARD")}
                            whileTap={{ scale: 0.95 }}
                        >
                            {t("payment_credit_card")}
                        </motion.button>
                        <motion.button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium ${paymentType === "DEBT" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() => setPaymentType("DEBT")}
                            whileTap={{ scale: 0.95 }}
                        >
                            {t("payment_debt")}
                        </motion.button>
                    </div>

                    <motion.div whileTap={{ scale: 0.95 }}>
                        <Button
                            variant="outline"
                            onClick={handleSaveDraft}
                            disabled={createOrder.isPending}
                            className="gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            {t("save_draft")}
                        </Button>
                    </motion.div>
                    <Button
                        onClick={handleSaveList}
                        disabled={items.length < 1 || createOrder.isPending}
                        className="gap-2"
                    >
                        <Save className="h-4 w-4" />
                        {t("save_list")}
                    </Button>
                </div>
            </div>

            {/* Total */}
            {items.length > 0 && (
                <motion.div
                    className="mb-4 flex items-center justify-end gap-2 text-lg font-semibold"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <span className="text-muted-foreground">{t("total_sum")}:</span>
                    <span>{formatCurrency(totalSum, t("common:sum"))}</span>
                </motion.div>
            )}

            {/* Items table */}
            <AnimatePresence mode="wait">
                {isProductsLoading ? (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <DataTableSkeleton columns={6} rows={5} className="flex-1" />
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
                            ref={tableRef}
                            className="costprice-table flex-1"
                            columns={columns}
                            initialColumnVisibility={initialColumnVisibility}
                            data={items}
                            enableEditing
                            onCellEdit={handleCellEdit}
                            onRowDelete={(rowIndex) => {
                                handleDeleteItem(rowIndex);
                                return rowIndex;
                            }}
                            enableMultipleNewRows
                            multiRowCount={50}
                            multiRowMaxCount={50}
                            onMultiRowSave={handleNewRowSave}
                            onMultiRowChange={handleNewRowChange}
                            multiRowDefaultValues={newRowDefaultValues}
                            enableSorting={false}
                            translations={translations}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/orders/new")({
    beforeLoad: async () => {
        const { permissions } = useAuthStore.getState();
        if (!hasPermission(permissions, Permission.ORDERS_CREATE)) {
            throw redirect({ to: "/" });
        }
    },
    validateSearch: (search) => newOrderSearchSchema.parse(search),
    component: NewOrderPage,
});
