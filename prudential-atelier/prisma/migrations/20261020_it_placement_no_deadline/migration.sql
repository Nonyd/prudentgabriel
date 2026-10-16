-- IT placements take applications all year round (decided 16 October 2026): no deadline.
UPDATE "JobPosting" SET "deadline" = NULL WHERE "type" = 'IT_PLACEMENT' AND "deadline" IS NOT NULL;
