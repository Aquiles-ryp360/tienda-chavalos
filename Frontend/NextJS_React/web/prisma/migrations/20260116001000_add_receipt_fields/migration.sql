-- CreateEnum (if not exists)
DO $$ BEGIN
  CREATE TYPE "CustomerDocType" AS ENUM ('DNI', 'RUC', 'PASAPORTE', 'OTRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable sales: Add new fields
ALTER TABLE "sales" 
  ADD COLUMN IF NOT EXISTS "customerDocType" "CustomerDocType",
  ADD COLUMN IF NOT EXISTS "customerDocNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "customerAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "institutionName" TEXT,
  ADD COLUMN IF NOT EXISTS "observations" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
