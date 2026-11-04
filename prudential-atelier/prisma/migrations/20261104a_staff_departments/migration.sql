-- New staff departments: Creative team, Supervisor, Production manager,
-- Assistant creative designer, Quality control, Store keeper.
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'CREATIVE_TEAM';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'SUPERVISOR';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'PRODUCTION_MANAGER';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'ASSISTANT_CREATIVE_DESIGNER';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'QUALITY_CONTROL';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'STORE_KEEPER';
