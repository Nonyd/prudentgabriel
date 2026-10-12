-- "View as client": an admin acting in a client's account. Start, every page and change, and exit are logged.
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CLIENT_VIEW_AS_START';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CLIENT_VIEW_AS_ACTION';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CLIENT_VIEW_AS_END';
