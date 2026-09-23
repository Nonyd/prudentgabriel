-- Slice BA3: a USD/GBP consultation booking locks its exchange rate and the
-- exact foreign amount at booking, so the charge is the figure she was shown.
-- AlterTable
ALTER TABLE "ConsultationBooking" ADD COLUMN     "fxAmountLocked" DOUBLE PRECISION,
ADD COLUMN     "fxGbpRateLocked" DOUBLE PRECISION,
ADD COLUMN     "fxRateFetchedAt" TIMESTAMP(3),
ADD COLUMN     "fxRateLocked" DOUBLE PRECISION,
ADD COLUMN     "fxRateSource" TEXT,
ADD COLUMN     "fxRateStale" BOOLEAN NOT NULL DEFAULT false;

-- The four consultation fees (22 September meeting) and the BA2 short-notice
-- window, so the settings exist on deploy. An existing row is never changed.
INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt") VALUES
  ('cl_consultation_fee_physical_prudent', 'consultation_fee_physical_prudent', '250000', 'PAYMENTS'::"SettingGroup", 'Consultation fee (₦): physical, with Mrs. Prudent', 'NUMBER'::"SettingType", false, 20, CURRENT_TIMESTAMP),
  ('cl_consultation_fee_physical_team', 'consultation_fee_physical_team', '200000', 'PAYMENTS'::"SettingGroup", 'Consultation fee (₦): physical, with the creative team', 'NUMBER'::"SettingType", false, 21, CURRENT_TIMESTAMP),
  ('cl_consultation_fee_virtual_prudent', 'consultation_fee_virtual_prudent', '200000', 'PAYMENTS'::"SettingGroup", 'Consultation fee (₦): virtual, with Mrs. Prudent', 'NUMBER'::"SettingType", false, 22, CURRENT_TIMESTAMP),
  ('cl_consultation_fee_virtual_team', 'consultation_fee_virtual_team', '180000', 'PAYMENTS'::"SettingGroup", 'Consultation fee (₦): virtual, with the creative team', 'NUMBER'::"SettingType", false, 23, CURRENT_TIMESTAMP),
  ('cl_consultation_short_notice_days', 'consultation_short_notice_days', '30', 'PAYMENTS'::"SettingGroup", 'Consultation enquiry: flag for a call when the event is within (days)', 'NUMBER'::"SettingType", false, 29, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
