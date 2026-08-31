-- Slice O: preferred contact at checkout, quote conversation note on the order.

CREATE TYPE "PreferredContactMethod" AS ENUM ('WHATSAPP', 'CALL', 'EMAIL');

ALTER TABLE "Order" ADD COLUMN "preferredContactMethod" "PreferredContactMethod";
ALTER TABLE "Order" ADD COLUMN "shippingQuoteNote" TEXT;
