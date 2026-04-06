-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateTable
CREATE TABLE "CronJobRun" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJobRun_jobName_ranAt_idx" ON "CronJobRun"("jobName", "ranAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");
