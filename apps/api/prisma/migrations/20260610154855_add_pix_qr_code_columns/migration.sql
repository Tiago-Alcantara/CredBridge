-- AlterTable
ALTER TABLE "ReceivableCollection" ADD COLUMN     "pixQrCodeBase64" TEXT,
ADD COLUMN     "pixQrCodeLocation" TEXT,
ADD COLUMN     "pixQrCodePayload" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "pixQrCodeBase64" TEXT;
