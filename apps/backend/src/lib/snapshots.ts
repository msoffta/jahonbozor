import type { Order } from "@backend/generated/prisma/client";
import type { DebtPaymentModel } from "@backend/generated/prisma/models/DebtPayment";
import type { ExpenseModel } from "@backend/generated/prisma/models/Expense";
import type { ProductModel } from "@backend/generated/prisma/models/Product";
import type { UsersModel } from "@backend/generated/prisma/models/Users";

interface OrderWithItems extends Pick<
    Order,
    "userId" | "staffId" | "paymentType" | "comment" | "data"
> {
    items?: { productId: number; quantity: number; price: unknown }[];
}

export function createOrderSnapshot(order: OrderWithItems) {
    return {
        userId: order.userId,
        staffId: order.staffId,
        paymentType: order.paymentType,
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

export function createProductSnapshot(product: ProductModel) {
    return {
        name: product.name,
        price: Number(product.price),
        costprice: Number(product.costprice),
        categoryId: product.categoryId,
        remaining: product.remaining,
    };
}

export function createExpenseSnapshot(expense: ExpenseModel) {
    return {
        name: expense.name,
        amount: Number(expense.amount),
        description: expense.description,
        expenseDate: expense.expenseDate,
        staffId: expense.staffId,
    };
}

export function createUserSnapshot(user: UsersModel) {
    return {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        phone: user.phone,
        photo: user.photo,
        telegramId: user.telegramId,
        language: user.language,
    };
}

export function createStaffSnapshot(staff: {
    fullname: string;
    username: string;
    roleId: number;
    telegramId?: bigint | null;
}) {
    return {
        fullname: staff.fullname,
        username: staff.username,
        roleId: staff.roleId,
        telegramId: staff.telegramId?.toString() ?? null,
    };
}

export function createCategorySnapshot(category: {
    id: number;
    name: string;
    parentId: number | null;
}) {
    return {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
    };
}

export function createRoleSnapshot(role: { name: string; permissions: string[] }) {
    return {
        name: role.name,
        permissions: role.permissions,
    };
}

export function createDebtPaymentSnapshot(payment: DebtPaymentModel) {
    return {
        orderId: payment.orderId,
        userId: payment.userId,
        amount: Number(payment.amount),
        staffId: payment.staffId,
        comment: payment.comment,
    };
}

export function createTelegramSessionSnapshot(session: {
    name: string;
    phone: string;
    status: string;
}) {
    return {
        name: session.name,
        phone: session.phone,
        status: session.status,
    };
}

export function createBroadcastTemplateSnapshot(template: {
    name: string;
    content: string;
    media: unknown;
    buttons: unknown;
}) {
    return {
        name: template.name,
        content: template.content,
        media: template.media,
        buttons: template.buttons,
    };
}

export function createBroadcastSnapshot(broadcast: {
    name: string;
    status: string;
    sendVia: string;
    sessionId: number | null;
    templateId: number | null;
    scheduledAt: Date | null;
}) {
    return {
        name: broadcast.name,
        status: broadcast.status,
        sendVia: broadcast.sendVia,
        sessionId: broadcast.sessionId,
        templateId: broadcast.templateId,
        scheduledAt: broadcast.scheduledAt,
    };
}
