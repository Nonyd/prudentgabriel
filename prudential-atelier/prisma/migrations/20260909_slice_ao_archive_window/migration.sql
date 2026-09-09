-- Slice AO: archive records when the alteration window ends, not when she confirms receipt.
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

-- Wording: delivery email names the window; beading is finished; final-fitting complete is not "approved".
UPDATE "SiteSetting" SET value = 'Your outfit is ready'
  WHERE key = 'email_bespoke_delivered_heading';
UPDATE "SiteSetting" SET value = E'Dear {{firstName}},\n\nYour atelier outfit {{orderRef}} is ready and has been marked delivered. Please confirm you have received it. Confirming receipt opens a {{warrantyDays}}-day window to request a fit or workmanship alteration — it does not close your file.'
  WHERE key = 'email_bespoke_delivered_body_1';
UPDATE "SiteSetting" SET value = 'After you confirm, you have {{warrantyDays}} days to ask for a tweak.'
  WHERE key = 'email_bespoke_delivered_body_2';

UPDATE "SiteSetting" SET value = 'The finishing touches are complete — {{orderRef}}'
  WHERE key = 'email_atelier_stage_beading_subject';
UPDATE "SiteSetting" SET value = 'Finishing touches complete'
  WHERE key = 'email_atelier_stage_beading_heading';
UPDATE "SiteSetting" SET value = 'Beading, embroidery, and the last details are finished. Your piece is ready for the final fitting.'
  WHERE key = 'email_atelier_stage_beading_body_1';

UPDATE "SiteSetting" SET value = 'Final fitting complete — {{orderRef}}'
  WHERE key = 'email_atelier_stage_final_fitting_subject';
UPDATE "SiteSetting" SET value = 'Final fitting complete'
  WHERE key = 'email_atelier_stage_final_fitting_heading';
UPDATE "SiteSetting" SET value = 'Your final fitting is complete. We are preparing the piece for delivery.'
  WHERE key = 'email_atelier_stage_final_fitting_body_1';

UPDATE "SiteSetting" SET value = E'Dear {{firstName}},\n\nYour account is for tracking this commission, viewing invoices, and the atelier portal. Design approval and receipt confirmation each arrive as their own link in a separate email — you do not need this password for those.'
  WHERE key = 'email_welcome_credentials_body_1';

UPDATE "SiteSetting" SET value = E'Dear {{firstName}},\n\nYour commission {{orderRef}} was marked delivered a week ago. Please confirm receipt — that opens a {{warrantyDays}}-day window to request a fit or workmanship alteration. Confirming does not close your file.'
  WHERE key = 'email_receipt_reminder_body_1';
