import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";
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
} from "@jahonbozor/ui";

import { clientDetailQueryOptions } from "@/api/clients.api";
import { useCreateOrder } from "@/api/orders.api";
import { productsListQueryOptions } from "@/api/products.api";
import { getOrderItemColumns } from "@/components/orders/order-items-columns";
import { useDataTableTranslations } from "@/hooks/use-data-table-translations";
import { useAuthStore } from "@/stores/auth.store";

const newOrderSearchSchema = z.object({
    userId: z.coerce.number().optional(),
});

interface LocalItem {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    product: { id: number; name: string; price?: number; remaining?: number; costprice?: number };
}

function NewOrderPage() {
    const { t } = useTranslation("orders");
    const navigate = useNavigate();
    const translations = useDataTableTranslations("no_items");
    const { userId } = Route.useSearch();

    const [items, setItems] = useState<LocalItem[]>([]);
    const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT_CARD" | "DEBT">("CASH");
    const [comment, setComment] = useState("");

    const { data: clientData } = useQuery(clientDetailQueryOptions(userId ?? 0));

    const { data: productsData, isLoading: isProductsLoading } = useQuery(
        productsListQueryOptions({ limit: 100, includeDeleted: false }),
    );

    const createOrder = useCreateOrder();
    const products = productsData?.products ?? [];

    const handleDeleteItem = useCallback((index: number) => {
        setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    }, []);

    const columns = useMemo(
        () => getOrderItemColumns(t, products, { onDelete: handleDeleteItem }),
        [t, products, handleDeleteItem],
    );

    const newRowDefaultValues = useMemo(() => ({ quantity: 1 }), []);

    const handleNewRowChange = useCallback(
        (values: Record<string, unknown>, _rowId: string) => {
            const currentQuantity = Number(values.quantity) || 1;

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

            return values;
        },
        [products],
    );

    const handleNewRowSave = useCallback(
        (data: Record<string, unknown>, _rowId: string, linkedId?: unknown) => {
            if (!data.product) return;

            const productId = Number(data.product);
            const product = products.find((p) => p.id === productId);
            if (!product) return;

            if (linkedId) {
                // Update existing item in local list
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === linkedId
                            ? {
                                  ...item,
                                  productId,
                                  quantity: Number(data.quantity) || 1,
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
                return linkedId;
            }

            // Create new item in local list
            const newId = Date.now() + Math.round(performance.now() * 1000);
            const newItem: LocalItem = {
                id: newId,
                productId,
                quantity: Number(data.quantity) || 1,
                price: product.price,
                product: {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    remaining: product.remaining,
                    costprice: product.costprice,
                },
            };

            setItems((prev) => [...prev, newItem]);
            return newId;
        },
        [products],
    );

    function handleSaveList() {
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

    const totalSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <PageTransition className="flex min-h-0 flex-1 flex-col p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <motion.button
                        type="button"
                        onClick={() => navigate({ to: "/orders" })}
                        className="border-border text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg border"
                        whileTap={{ scale: 0.9 }}
                        aria-label={t("common:back")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                    <div>
                        <h1 className="text-2xl font-bold">{t("lists_title")}</h1>
                        {clientData && (
                            <p className="text-muted-foreground text-sm">
                                {t("order_client")}: {clientData.fullname}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Input
                        placeholder={t("order_comment")}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="h-9 w-48 text-sm"
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
                    <span>{totalSum.toLocaleString()}</span>
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
                            className="costprice-table flex-1"
                            columns={columns}
                            data={items}
                            enableMultipleNewRows
                            multiRowCount={15}
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
