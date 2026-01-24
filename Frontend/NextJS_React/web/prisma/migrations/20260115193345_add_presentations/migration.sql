/*
  Warnings:

  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `stock` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - You are about to alter the column `minStock` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - You are about to drop the column `quantity` on the `sale_items` table. All the data in the column will be lost.
  - You are about to alter the column `unitPrice` on the `sale_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `subtotal` on the `sale_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `subtotal` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `tax` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `total` on the `sales` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `quantity` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - You are about to alter the column `previousStock` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - You are about to alter the column `newStock` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - Added the required column `baseQty` to the `sale_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `soldQty` to the `sale_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `soldUnit` to the `sale_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ProductUnit" ADD VALUE 'ROLLO';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "minStock" SET DEFAULT 5,
ALTER COLUMN "minStock" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "sale_items" DROP COLUMN "quantity",
ADD COLUMN     "baseQty" DECIMAL(12,3) DEFAULT 0,
ADD COLUMN     "presentationId" TEXT,
ADD COLUMN     "soldQty" DECIMAL(12,3) DEFAULT 0,
ADD COLUMN     "soldUnit" "ProductUnit" DEFAULT 'UNIDAD',
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2);

-- Update existing rows to have valid values
UPDATE "sale_items" SET "baseQty" = COALESCE("baseQty", 0) WHERE "baseQty" IS NULL;
UPDATE "sale_items" SET "soldQty" = COALESCE("soldQty", 0) WHERE "soldQty" IS NULL;
UPDATE "sale_items" SET "soldUnit" = COALESCE("soldUnit", 'UNIDAD') WHERE "soldUnit" IS NULL;

-- Alter columns to NOT NULL
ALTER TABLE "sale_items" ALTER COLUMN "baseQty" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "soldQty" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "soldUnit" SET NOT NULL;

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "previousStock" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "newStock" SET DATA TYPE DECIMAL(12,3);

-- CreateTable
CREATE TABLE "product_presentations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "ProductUnit" NOT NULL,
    "factorToBase" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_presentations_productId_idx" ON "product_presentations"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_presentations_productId_name_key" ON "product_presentations"("productId", "name");

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
