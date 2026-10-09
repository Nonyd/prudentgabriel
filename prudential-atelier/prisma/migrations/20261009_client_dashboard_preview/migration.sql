-- "Preview her dashboard": the activity log records who looked, at whose dashboard, when.
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CLIENT_DASHBOARD_PREVIEW';
