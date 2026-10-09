-- The maintenance message as typed in Admin → Settings read "Major Maintianance".
-- Fix the spelling only; whether maintenance is on is left exactly as it is.
UPDATE "SiteSetting"
SET "value" = replace("value", 'Maintianance', 'Maintenance'), "updatedAt" = now()
WHERE "key" = 'maintenance_mode_message' AND "value" LIKE '%Maintianance%';
