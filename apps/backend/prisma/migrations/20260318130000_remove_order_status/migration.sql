-- Soft-delete any CANCELLED orders that have deletedAt IS NULL (data safety)
UPDATE "Order" SET "deletedAt" = NOW() WHERE "status" = 'CANCELLED' AND "deletedAt" IS NULL;

-- DropIndex
DROP INDEX "Order_status_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status";

-- DropEnum
DROP TYPE "OrderStatus";

-- AlterEnum: remove ORDER_STATUS_CHANGE from AuditAction
-- PostgreSQL doesn't support DROP VALUE from enum, so we recreate it
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'INVENTORY_ADJUST', 'DEBT_PAYMENT');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction" USING ("action"::text::"AuditAction");
DROP TYPE "AuditAction_old";
