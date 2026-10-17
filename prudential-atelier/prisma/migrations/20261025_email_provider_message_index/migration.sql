-- Resend webhooks look up the outbox row by the id Resend returned at send time.
CREATE INDEX "EmailMessage_providerMessageId_idx" ON "EmailMessage"("providerMessageId");
