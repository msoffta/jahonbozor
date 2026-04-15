-- Delete unfinished DRAFT orders (inventory was never deducted, safe to drop)
DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "status" = 'DRAFT');
DELETE FROM "Order" WHERE "status" = 'DRAFT';

-- Drop status index and column
DROP INDEX IF EXISTS "Order_status_idx";
ALTER TABLE "Order" DROP COLUMN "status";

-- Drop OrderStatus enum
DROP TYPE "OrderStatus";

-- Drop username from Users
ALTER TABLE "Users" DROP COLUMN "username";
