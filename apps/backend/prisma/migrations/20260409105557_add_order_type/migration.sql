-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('ORDER', 'LIST');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'ORDER';

-- Backfill: orders with 2+ items → LIST, empty drafts → LIST
UPDATE "Order" SET "type" = 'LIST'
WHERE id IN (
    SELECT "orderId" FROM "OrderItem" GROUP BY "orderId" HAVING COUNT(*) >= 2
)
OR id NOT IN (
    SELECT DISTINCT "orderId" FROM "OrderItem"
);

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");
