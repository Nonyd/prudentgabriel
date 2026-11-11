-- Creative Team: Illustrator and the team's Admin join the departments.
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'ILLUSTRATOR';
ALTER TYPE "StaffDepartment" ADD VALUE IF NOT EXISTS 'CREATIVE_ADMIN';
