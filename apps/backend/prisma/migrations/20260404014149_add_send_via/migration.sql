-- CreateEnum
CREATE TYPE "BroadcastSendVia" AS ENUM ('BOT', 'SESSION');

-- DropForeignKey
ALTER TABLE "Broadcast" DROP CONSTRAINT "Broadcast_sessionId_fkey";

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "sendVia" "BroadcastSendVia" NOT NULL DEFAULT 'SESSION',
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
