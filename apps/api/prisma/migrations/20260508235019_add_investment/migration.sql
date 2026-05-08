-- Note: includes drift cleanup for User.updatedAt (Prisma-generated, harmless).
-- The schema defines updatedAt with @updatedAt (auto-managed), not DEFAULT.
-- Removing stale DEFAULT from previous migration.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "investorUserId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "faceValue" DOUBLE PRECISION NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pixTxId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investment_receivableId_key" ON "Investment"("receivableId");

-- CreateIndex
CREATE INDEX "Investment_investorUserId_idx" ON "Investment"("investorUserId");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
