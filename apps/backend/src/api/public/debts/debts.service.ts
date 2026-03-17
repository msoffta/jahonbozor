import { prisma } from "@backend/lib/prisma";

import type { Logger } from "@jahonbozor/logger";
import type { DebtPaymentsListResponse, DebtSummaryResponse } from "@jahonbozor/schemas/src/debts";

interface DebtTotalRow {
    totalDebt: number;
    debtOrdersCount: number;
}

interface PaidTotalRow {
    totalPaid: number;
}

export abstract class PublicDebtsService {
    static async getMyDebtSummary(userId: number, logger: Logger): Promise<DebtSummaryResponse> {
        try {
            const [debtTotals, paidTotals] = await Promise.all([
                prisma.$queryRaw<DebtTotalRow[]>`
                    SELECT
                        COALESCE(SUM(oi.price * oi.quantity), 0)::float8 AS "totalDebt",
                        COUNT(DISTINCT o.id)::integer AS "debtOrdersCount"
                    FROM "Order" o
                    JOIN "OrderItem" oi ON oi."orderId" = o.id
                    WHERE o."userId" = ${userId}
                        AND o."paymentType" = 'DEBT'
                        AND o."status" != 'CANCELLED'
                        AND o."deletedAt" IS NULL
                `,
                prisma.$queryRaw<PaidTotalRow[]>`
                    SELECT COALESCE(SUM(amount), 0)::float8 AS "totalPaid"
                    FROM "DebtPayment"
                    WHERE "userId" = ${userId}
                `,
            ]);

            const totalDebt = debtTotals[0]?.totalDebt ?? 0;
            const debtOrdersCount = debtTotals[0]?.debtOrdersCount ?? 0;
            const totalPaid = paidTotals[0]?.totalPaid ?? 0;
            const balance = totalDebt - totalPaid;

            return {
                success: true,
                data: { totalDebt, totalPaid, balance, debtOrdersCount },
            };
        } catch (error) {
            logger.error("PublicDebts: Error in getMyDebtSummary", { userId, error });
            return { success: false, error };
        }
    }

    static async getMyDebtPayments(
        userId: number,
        logger: Logger,
    ): Promise<DebtPaymentsListResponse> {
        try {
            const payments = await prisma.debtPayment.findMany({
                where: { userId },
                include: {
                    staff: { select: { id: true, fullname: true } },
                },
                orderBy: { paidAt: "desc" },
            });

            return {
                success: true,
                data: {
                    payments: payments.map((p) => ({
                        id: p.id,
                        orderId: p.orderId,
                        userId: p.userId,
                        amount: Number(p.amount),
                        paidAt: p.paidAt,
                        staffId: p.staffId,
                        comment: p.comment,
                        staff: p.staff,
                        createdAt: p.createdAt,
                    })),
                },
            };
        } catch (error) {
            logger.error("PublicDebts: Error in getMyDebtPayments", { userId, error });
            return { success: false, error };
        }
    }
}
