-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "staffId" INTEGER;

-- CreateIndex
CREATE INDEX "Product_staffId_idx" ON "Product"("staffId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
