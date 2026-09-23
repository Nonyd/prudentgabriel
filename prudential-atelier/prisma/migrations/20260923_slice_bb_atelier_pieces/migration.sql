-- Slice BB3: one piece, one entry. A gallery frame can belong to another
-- frame (the piece's main photograph), which carries the description and the
-- BA4 price guide for the whole piece. Display only, like BA4.
-- AlterTable
ALTER TABLE "GalleryImage" ADD COLUMN "description" TEXT,
ADD COLUMN "pieceOfId" TEXT;

-- CreateIndex
CREATE INDEX "GalleryImage_pieceOfId_idx" ON "GalleryImage"("pieceOfId");

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_pieceOfId_fkey" FOREIGN KEY ("pieceOfId") REFERENCES "GalleryImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
