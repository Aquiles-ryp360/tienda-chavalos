-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "priceAdjustNote" TEXT,
ADD COLUMN     "unitPriceOverride" DECIMAL(12,2);
