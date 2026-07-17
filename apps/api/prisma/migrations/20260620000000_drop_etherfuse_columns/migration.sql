-- DropColumn etherfuseCustomerId from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "etherfuseCustomerId";

-- DropColumn etherfuseBankAccountId from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "etherfuseBankAccountId";
