import { createFileRoute } from "@tanstack/react-router";

function OrderDetailPage() {
    const { orderId } = Route.useParams();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">Order #{orderId}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_auth/orders/$orderId")({
    component: OrderDetailPage,
});
