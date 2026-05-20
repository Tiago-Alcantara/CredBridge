ALTER TABLE "User" ADD COLUMN "passkeyPublicKey" TEXT;
ALTER TABLE "User" ADD COLUMN "walletType" TEXT;
ALTER TABLE "User" ADD COLUMN "walletStatus" TEXT;

CREATE TABLE "FinancialAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resourceId" TEXT,
    "amount" TEXT,
    "destination" TEXT,
    "nonce" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAuthorization_nonce_key" ON "FinancialAuthorization"("nonce");
CREATE UNIQUE INDEX "FinancialAuthorization_payloadHash_key" ON "FinancialAuthorization"("payloadHash");
CREATE INDEX "FinancialAuthorization_userId_operation_idx" ON "FinancialAuthorization"("userId", "operation");
CREATE INDEX "FinancialAuthorization_expiresAt_idx" ON "FinancialAuthorization"("expiresAt");

ALTER TABLE "FinancialAuthorization"
ADD CONSTRAINT "FinancialAuthorization_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
