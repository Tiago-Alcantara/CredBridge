-- Migration: pix_integration
-- Adds Pix fields to Transaction and creates PixWebhookEvent + ReceivableCollection

-- Extend Transaction with Pix reconciliation fields
ALTER TABLE "Transaction" ADD COLUMN "pixOrderId" TEXT UNIQUE;
ALTER TABLE "Transaction" ADD COLUMN "pixIdentifier" TEXT UNIQUE;
ALTER TABLE "Transaction" ADD COLUMN "pixTxid" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixPaymentId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixEndToEndId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixQrCodePayload" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixQrCodeLocation" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixExpiresAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "pixConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "pixFailureReason" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixMetadata" JSONB;

-- Indexes for Pix reconciliation lookups
CREATE INDEX "Transaction_pixIdentifier_idx" ON "Transaction"("pixIdentifier");
CREATE INDEX "Transaction_pixOrderId_idx" ON "Transaction"("pixOrderId");

-- PixWebhookEvent: idempotência de callbacks do microserviço Pix
CREATE TABLE "PixWebhookEvent" (
    "id"          TEXT NOT NULL,
    "eventId"     TEXT NOT NULL,
    "pixOrderId"  TEXT NOT NULL,
    "externalId"  TEXT NOT NULL,
    "identifier"  TEXT,
    "type"        TEXT NOT NULL,
    "status"      TEXT NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "payload"     JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PixWebhookEvent_eventId_key" ON "PixWebhookEvent"("eventId");
CREATE INDEX "PixWebhookEvent_pixOrderId_idx" ON "PixWebhookEvent"("pixOrderId");
CREATE INDEX "PixWebhookEvent_externalId_idx" ON "PixWebhookEvent"("externalId");
CREATE INDEX "PixWebhookEvent_identifier_idx" ON "PixWebhookEvent"("identifier");

-- ReceivableCollection: cobrança futura ao sacado de NF-e antecipada
CREATE TABLE "ReceivableCollection" (
    "id"           TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "pixOrderId"   TEXT UNIQUE,
    "identifier"   TEXT UNIQUE,
    "amount"       DOUBLE PRECISION NOT NULL,
    "dueDate"      TIMESTAMP(3) NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending_payment',
    "txHash"       TEXT,
    "endToEndId"   TEXT,
    "paidAt"       TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivableCollection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceivableCollection_receivableId_idx" ON "ReceivableCollection"("receivableId");
