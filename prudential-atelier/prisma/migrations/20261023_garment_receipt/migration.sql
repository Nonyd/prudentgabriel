-- How an atelier client receives the finished piece, asked when she books the consultation.
ALTER TABLE "ConsultationBooking" ADD COLUMN "garmentReceipt" JSONB;
