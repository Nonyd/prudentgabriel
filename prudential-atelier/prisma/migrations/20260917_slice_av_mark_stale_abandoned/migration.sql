-- Past TTL unpaid holds that already sit as FAILED should read as abandoned, not live retries.
UPDATE "Order"
SET status = 'ABANDONED'
WHERE status = 'PENDING'
  AND "paymentStatus" = 'FAILED'
  AND (
    ("paymentGateway" IS DISTINCT FROM 'BANK_TRANSFER' AND "createdAt" <= NOW() - INTERVAL '24 hours')
    OR ("paymentGateway" = 'BANK_TRANSFER' AND "createdAt" <= NOW() - INTERVAL '7 days')
  );
