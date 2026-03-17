import type { Order } from "@backend/generated/prisma/client";

interface OrderWithItems extends Pick<Order, "userId" | "staffId" | "paymentType" | "status" | "comment" | "data"> {
	items?: Array<{ productId: number; quantity: number; price: unknown }>;
}

export function createOrderSnapshot(order: OrderWithItems) {
	return {
		userId: order.userId,
		staffId: order.staffId,
		paymentType: order.paymentType,
		status: order.status,
		comment: order.comment,
		data: order.data,
		...(order.items && {
			items: order.items.map((item) => ({
				productId: item.productId,
				quantity: item.quantity,
				price: Number(item.price),
			})),
		}),
	};
}
