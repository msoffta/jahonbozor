import { createFileRoute } from "@tanstack/react-router";

function ProductDetailPage() {
    const { productId } = Route.useParams();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">Product #{productId}</h1>
        </div>
    );
}

export const Route = createFileRoute("/_auth/products/$productId")({
    component: ProductDetailPage,
});
