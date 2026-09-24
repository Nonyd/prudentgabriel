-- Atelier demo content: a row whose words and price guide were invented for
-- review on staging, not written by the house. Never rendered in production.
-- AlterTable
ALTER TABLE "GalleryImage" ADD COLUMN "placeholder" BOOLEAN NOT NULL DEFAULT false;
