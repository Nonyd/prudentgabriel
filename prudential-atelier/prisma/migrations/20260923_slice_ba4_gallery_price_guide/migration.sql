-- Slice BA4: a display-only price guide on atelier photographs. Nothing that
-- charges money reads GalleryImage.
-- AlterTable
ALTER TABLE "GalleryImage" ADD COLUMN     "priceCeilingNGN" INTEGER,
ADD COLUMN     "priceFloorNGN" INTEGER;
