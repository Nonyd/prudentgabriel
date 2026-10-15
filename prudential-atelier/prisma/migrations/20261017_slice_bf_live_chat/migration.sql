-- Slice BF: live chat, properly staffed.

-- BF5: the name a stranger sees in chat. Unset means the first name.
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- BF9: chat recipients are chosen by name.
ALTER TABLE "AdminNotification" ADD COLUMN "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'CHAT';

-- BF4: a name plus one of email or phone. Existing conversations all have an email.
ALTER TABLE "ChatConversation" ALTER COLUMN "visitorEmail" DROP NOT NULL;
ALTER TABLE "ChatConversation" ADD COLUMN "visitorPhone" TEXT;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_contact_check"
  CHECK ("visitorEmail" IS NOT NULL OR "visitorPhone" IS NOT NULL);

-- BF5: one conversation, one handler.
ALTER TABLE "ChatConversation" ADD COLUMN "handlerId" TEXT;
ALTER TABLE "ChatConversation" ADD COLUMN "handlerName" TEXT;
ALTER TABLE "ChatConversation" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "ChatConversation" ADD COLUMN "handlerActiveAt" TIMESTAMP(3);

-- BF6: when nobody comes. BF2: written while the house was closed.
ALTER TABLE "ChatConversation" ADD COLUMN "awaitingSince" TIMESTAMP(3);
ALTER TABLE "ChatConversation" ADD COLUMN "unansweredStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChatConversation" ADD COLUMN "offHoursAt" TIMESTAMP(3);

CREATE INDEX "ChatConversation_userId_idx" ON "ChatConversation"("userId");
CREATE INDEX "ChatConversation_awaitingSince_idx" ON "ChatConversation"("awaitingSince");

-- BF5: a takeover line only the house sees.
ALTER TABLE "ChatMessage" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;

-- BF8: edits are appended, never written over the original.
CREATE TABLE "ChatMessageRevision" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatMessageRevision_messageId_createdAt_idx" ON "ChatMessageRevision"("messageId", "createdAt");
ALTER TABLE "ChatMessageRevision" ADD CONSTRAINT "ChatMessageRevision_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BF7: files, both directions.
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "author" "ChatAuthor" NOT NULL,
    "staffUserId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatAttachment_conversationId_idx" ON "ChatAttachment"("conversationId");
CREATE INDEX "ChatAttachment_storageKey_idx" ON "ChatAttachment"("storageKey");
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Images and PDF only: the allowlist is enforced by magic bytes in the upload path, and again here.
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_mime_check"
  CHECK ("mime" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));

-- What was said is kept: a message's words and an edit row cannot be rewritten.
-- Deleting stays possible, because retention and the SUPER_ADMIN erase must work.
CREATE OR REPLACE FUNCTION chat_words_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ChatMessage' AND NEW."body" IS NOT DISTINCT FROM OLD."body" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Chat words are append-only: rewriting % is not allowed (id=%). Add a revision instead.', TG_TABLE_NAME, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS chat_message_body_append_only_trg ON "ChatMessage";
CREATE TRIGGER chat_message_body_append_only_trg
  BEFORE UPDATE ON "ChatMessage"
  FOR EACH ROW
  EXECUTE PROCEDURE chat_words_append_only();

DROP TRIGGER IF EXISTS chat_message_revision_append_only_trg ON "ChatMessageRevision";
CREATE TRIGGER chat_message_revision_append_only_trg
  BEFORE UPDATE ON "ChatMessageRevision"
  FOR EACH ROW
  EXECUTE PROCEDURE chat_words_append_only();
