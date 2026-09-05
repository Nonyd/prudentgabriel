-- Slice AC: keep a structured snapshot on ActivityLog after a product cascade delete.
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;
