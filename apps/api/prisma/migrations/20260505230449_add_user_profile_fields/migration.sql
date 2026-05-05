/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "investorType" TEXT,
ADD COLUMN     "monthlyRevenue" DOUBLE PRECISION,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "operationalLimit" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "riskProfile" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
