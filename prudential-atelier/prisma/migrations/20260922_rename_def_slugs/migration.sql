-- Four published pieces were duplicated from a product slugged "def" and kept
-- placeholder slugs (/shop/def-copy-copy…) that went into the sitemap.
-- Rename each only if the old slug exists and the new one is free, so this is
-- a no-op wherever those rows are absent. redirects.mjs sends the old URLs on
-- with a permanent redirect.
UPDATE "Product" SET "slug" = 'delphinium-dress'
  WHERE "slug" = 'def' AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "slug" = 'delphinium-dress');
UPDATE "Product" SET "slug" = 'poppy-2-piece'
  WHERE "slug" = 'def-copy' AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "slug" = 'poppy-2-piece');
UPDATE "Product" SET "slug" = 'camellia-dress'
  WHERE "slug" = 'def-copy-copy' AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "slug" = 'camellia-dress');
UPDATE "Product" SET "slug" = 'primrose-dress'
  WHERE "slug" = 'def-copy-copy-copy' AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "slug" = 'primrose-dress');
