-- Couture gown box: err large so international DHL quotes do not undercharge.
-- Volumetric (L×W×H / 5000) for 60×40×20 = 9.6 kg; the previous 40×30×12 was 2.88 kg.
UPDATE "PackagingProfile"
SET "weightKg" = 0.8,
    "lengthCm" = 60,
    "widthCm" = 40,
    "heightCm" = 20,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pkg-garment-box';
