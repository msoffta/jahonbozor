import { createFileRoute } from "@tanstack/react-router";
import { PageTransition } from "@jahonbozor/ui";

function OrderDetailPage() {
    const { orderId } = Route.useParams();

    return (
        <PageTransition className="p-6">
            <h1 className="text-2xl font-bold">Order #{orderId}</h1>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/orders/$orderId")({
    component: OrderDetailPage,
});
