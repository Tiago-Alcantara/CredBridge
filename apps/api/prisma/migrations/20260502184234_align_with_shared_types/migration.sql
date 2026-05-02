/*
  Warnings:

  - You are about to drop the column `uploadedAt` on the `Document` table. All the data in the column will be lost.
  - Added the required column `debtorDocument` to the `Receivable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `debtorName` to the `Receivable` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "uploadedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Receivable" ADD COLUMN     "debtorDocument" TEXT NOT NULL,
ADD COLUMN     "debtorName" TEXT NOT NULL;
