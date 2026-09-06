-- Slice AD3.0 — publish twelve house pieces that already have photographs.
-- Staging VPS only. Idempotent: skips already-published rows.
-- Does not touch Slice/Z1/AA/AC/Stock Launch test gowns.

\echo AD3 unpublished audit
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "isPublished") AS published,
  COUNT(*) FILTER (WHERE NOT "isPublished") AS unpublished,
  COUNT(*) FILTER (
    WHERE NOT "isPublished"
      AND "createdAt" = "updatedAt"
  ) AS unpublished_never_touched
FROM "Product";

WITH house AS (
  SELECT
    p.id,
    p.name,
    p.slug,
    CASE
      WHEN p.name ILIKE '%avril%' THEN 1
      WHEN p.name ILIKE '%alouette%' THEN 2
      WHEN p.name ILIKE '%allure%' THEN 3
      WHEN p.name ILIKE '%netania%' THEN 4
      WHEN p.name ILIKE '%delphinium%' THEN 5
      ELSE 50
    END AS pref
  FROM "Product" p
  WHERE p."isPublished" = false
    AND p.name !~* '(slice |^z1 |^aa |^ac |stock launch|loud delete|fail delete|test gown)'
    AND EXISTS (
      SELECT 1
      FROM "ProductImage" img
      WHERE img."productId" = p.id
        AND length(trim(img.url)) > 8
        AND img.url NOT ILIKE '%placeholder%'
    )
  ORDER BY pref ASC, p.name ASC
  LIMIT 12
)
UPDATE "Product" p
SET
  "isPublished" = true,
  "updatedAt" = NOW()
FROM house
WHERE p.id = house.id
RETURNING p.name, p.slug;
