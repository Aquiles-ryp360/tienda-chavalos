-- AlterTable
ALTER TABLE "product_presentations" ADD COLUMN     "priceOverride" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "overrideNote" TEXT,
ADD COLUMN     "stockOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "price_changes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "presentationId" TEXT,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_changes_productId_idx" ON "price_changes"("productId");

-- CreateIndex
CREATE INDEX "price_changes_createdAt_idx" ON "price_changes"("createdAt");

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "product_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
