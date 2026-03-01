import { createFileRoute } from "@tanstack/react-router";
import { PageTransition } from "@jahonbozor/ui";

function ProductDetailPage() {
    const { productId } = Route.useParams();

    return (
        <PageTransition className="p-6">
            <h1 className="text-2xl font-bold">Product #{productId}</h1>
        </PageTransition>
    );
}

export const Route = createFileRoute("/_dashboard/products/$productId")({
    component: ProductDetailPage,
});
