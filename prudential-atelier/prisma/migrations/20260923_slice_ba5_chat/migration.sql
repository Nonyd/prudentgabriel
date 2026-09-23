-- Slice BA5: first-party live chat. Context is per conversation, not per
-- visitor. Retention is set by the house before chat can be switched on.
-- CreateEnum
CREATE TYPE "ChatContextKind" AS ENUM ('PIECE', 'SHOP', 'ORDER', 'ATELIER', 'GENERAL');

-- CreateEnum
CREATE TYPE "ChatAuthor" AS ENUM ('VISITOR', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL DEFAULT encode(sha256(convert_to(((gen_random_uuid())::text || (gen_random_uuid())::text), 'UTF8'::name)), 'hex'::text),
    "publicTokenExpiresAt" TIMESTAMP(3),
    "visitorName" TEXT NOT NULL,
    "visitorEmail" TEXT NOT NULL,
    "userId" TEXT,
    "contextKind" "ChatContextKind" NOT NULL,
    "contextPath" TEXT NOT NULL,
    "contextLabel" TEXT,
    "productId" TEXT,
    "orderRef" TEXT,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffSeenAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "author" "ChatAuthor" NOT NULL,
    "staffUserId" TEXT,
    "staffName" TEXT,
    "body" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_publicToken_key" ON "ChatConversation"("publicToken");

-- CreateIndex
CREATE INDEX "ChatConversation_status_lastMessageAt_idx" ON "ChatConversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatConversation_lastMessageAt_idx" ON "ChatConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
