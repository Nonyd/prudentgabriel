-- Slice AE: portrait reels inside a collection gallery.
CREATE TABLE "CollectionReel" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "videoKey" TEXT NOT NULL,
    "posterKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 3,
    "productId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionReel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionReel_collectionId_isActive_idx" ON "CollectionReel"("collectionId", "isActive");
CREATE INDEX "CollectionReel_collectionId_sortOrder_idx" ON "CollectionReel"("collectionId", "sortOrder");

ALTER TABLE "CollectionReel" ADD CONSTRAINT "CollectionReel_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionReel" ADD CONSTRAINT "CollectionReel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
