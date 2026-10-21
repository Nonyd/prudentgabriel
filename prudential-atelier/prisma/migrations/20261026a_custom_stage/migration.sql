-- A step the house adds to one commission. Its own migration: Postgres cannot use
-- a new enum value in the transaction that adds it, and 20261026b_order_steps does.
ALTER TYPE "BespokeStage" ADD VALUE 'CUSTOM';
