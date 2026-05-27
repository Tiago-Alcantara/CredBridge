-- AlterTable
ALTER TABLE "User" ADD COLUMN "privyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "privyStellarWalletAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "privyWalletStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyStellarWalletAddress_key" ON "User"("privyStellarWalletAddress");
