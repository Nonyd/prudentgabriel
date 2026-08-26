/**
 * Slice H: unsubscribe suppress, campaign dedupe, deferred drain, transactional priority, product duplicate.
 *
 *   pnpm test:slice-h
 */
import "./preload-test-env";
import { EmailStatus, ProductCategory, ProductType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { setEmailProvidersForTest, type EmailProvider } from "../src/lib/email-providers";
import {
  drainQueuedEmails,
  queueEmail,
  setSkipImmediateDeliverForTest,
} from "../src/lib/email-outbox";
import {
  ensureEmailPreference,
  normalizeEmail,
  unsubscribeByToken,
} from "../src/lib/email-consent";
import { resolveCampaignRecipients } from "../src/lib/send-email-recipients";
import { createEmailSendJob, queueCampaignEmails } from "../src/lib/send-email-jobs";
import { duplicateProduct } from "../src/lib/duplicate-product";
import { previewUnpublishImpact } from "../src/lib/collection-publish";
import { formatUnpublishImpactMessage } from "../src/lib/collection-unpublish-impact";
import { EMAIL_PRIORITY_MARKETING, EMAIL_PRIORITY_TRANSACTIONAL } from "../src/lib/email-priority";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-h-${Date.now()}`;
const ids: {
  emails: string[];
  productIds: string[];
  userIds: string[];
  jobIds: string[];
  collectionIds: string[];
} = {
  emails: [],
  productIds: [],
  userIds: [],
  jobIds: [],
  collectionIds: [],
};

function okProvider(): EmailProvider {
  return {
    name: "test-ok",
    isConfigured: () => true,
    send: async () => ({ id: `ok-${Date.now()}` }),
  };
}

async function cleanup() {
  await prisma.emailMessage.deleteMany({
    where: { idempotencyKey: { startsWith: stamp } },
  });
  if (ids.jobIds.length) {
    await prisma.emailMessage.deleteMany({ where: { relatedId: { in: ids.jobIds } } });
    await prisma.emailSendJob.deleteMany({ where: { id: { in: ids.jobIds } } });
  }
  await prisma.newsletterSubscriber.deleteMany({
    where: { email: { contains: stamp } },
  });
  await prisma.emailPreference.deleteMany({
    where: { email: { contains: stamp } },
  });
  if (ids.collectionIds.length) {
    await prisma.collection.deleteMany({ where: { id: { in: ids.collectionIds } } });
  }
  if (ids.productIds.length) {
    await prisma.product.deleteMany({ where: { id: { in: ids.productIds } } });
  }
  if (ids.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  }
}

async function testUnsubscribeExcluded() {
  const email = normalizeEmail(`${stamp}-unsub@example.test`);
  await prisma.newsletterSubscriber.create({ data: { email } });
  const pref = await ensureEmailPreference(email);
  const result = await unsubscribeByToken(pref.unsubscribeToken);
  assert(result?.email === email, "unsubscribe returns email");
  const resolved = await resolveCampaignRecipients({ sources: ["newsletter"] });
  assert(!resolved.emails.includes(email), "unsubscribed address excluded at resolve");
}

async function testDedupe() {
  const email = normalizeEmail(`${stamp}-dup@example.test`);
  await prisma.newsletterSubscriber.create({ data: { email } });
  const user = await prisma.user.create({
    data: { email, name: "Dupe", role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  const resolved = await resolveCampaignRecipients({ sources: ["newsletter", "customers"] });
  const hits = resolved.emails.filter((e) => e === email);
  assert(hits.length === 1, `expected 1 deduped hit, got ${hits.length}`);
}

async function testCampaignQueuesWithoutSending() {
  setSkipImmediateDeliverForTest(true);
  setEmailProvidersForTest([okProvider()]);
  const to = `${stamp}-camp@example.test`;
  const job = await createEmailSendJob({
    recipientType: "custom",
    recipients: [to],
    subject: "Drop",
    body: "<p>Hello</p>",
    createdBy: "test",
  });
  ids.jobIds.push(job.id);
  await queueCampaignEmails(job.id);
  const queued = await prisma.emailMessage.findMany({
    where: { relatedId: job.id, relatedType: "EmailSendJob" },
  });
  assert(queued.length === 1, "campaign queued one outbox row");
  assert(queued[0]!.status === EmailStatus.QUEUED, "still queued — tab not required");
  assert(queued[0]!.priority === EMAIL_PRIORITY_MARKETING, "marketing priority");
  assert(queued[0]!.html.includes("/unsubscribe/"), "unsubscribe link in html");
  const headers = queued[0]!.headers as Record<string, string> | null;
  assert(headers?.["List-Unsubscribe"], "List-Unsubscribe header stored");
  assert(headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", "one-click header");

  const drain = await drainQueuedEmails({
    now: new Date(),
    batchLimit: 50,
    isBudgetExhausted: () => false,
  });
  assert(drain.processed >= 1, "drain delivers without admin tab");
  const after = await prisma.emailMessage.findUnique({ where: { id: queued[0]!.id } });
  assert(after?.status === EmailStatus.SENT, "campaign sent via drain");
}

async function testTransactionalWins() {
  setSkipImmediateDeliverForTest(true);
  setEmailProvidersForTest([okProvider()]);
  const mids: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const row = await queueEmail({
      to: `${stamp}-m${i}@example.test`,
      subject: "m",
      html: "<p>m</p>",
      template: "admin-broadcast",
      idempotencyKey: `${stamp}:m:${i}`,
      priority: EMAIL_PRIORITY_MARKETING,
      defer: true,
    });
    mids.push(row.id);
  }
  const tx = await queueEmail({
    to: `${stamp}-tx@example.test`,
    subject: "order",
    html: "<p>order</p>",
    template: "order-confirmation",
    idempotencyKey: `${stamp}:tx`,
    priority: EMAIL_PRIORITY_TRANSACTIONAL,
    defer: true,
  });
  await drainQueuedEmails({
    now: new Date(),
    batchLimit: 3,
    isBudgetExhausted: () => false,
  });
  const txRow = await prisma.emailMessage.findUnique({ where: { id: tx.id } });
  assert(txRow?.status === EmailStatus.SENT, "transactional sent in the first drain");
  const marketingSent = await prisma.emailMessage.count({
    where: { id: { in: mids }, status: EmailStatus.SENT },
  });
  assert(marketingSent <= 2, `marketing capped behind transactional, got ${marketingSent} sent`);
  const marketingQueued = await prisma.emailMessage.count({
    where: { id: { in: mids }, status: EmailStatus.QUEUED },
  });
  assert(marketingQueued >= 3, "remaining marketing stays queued");
}

async function testDuplicateProduct() {
  const product = await prisma.product.create({
    data: {
      name: `${stamp} gown`,
      slug: `${stamp}-gown`,
      description: "src",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      isPublished: true,
      variants: {
        create: [
          { size: "S", priceNGN: 10_000, stock: 2, sku: `${stamp}-S` },
          { size: "M", priceNGN: 10_000, stock: 2, sku: `${stamp}-M` },
        ],
      },
    },
  });
  ids.productIds.push(product.id);
  const copy = await duplicateProduct(product.id);
  assert(copy, "duplicate returns a product");
  ids.productIds.push(copy!.id);
  assert(copy!.slug !== product.slug, "distinct slug");
  const loaded = await prisma.product.findUnique({
    where: { id: copy!.id },
    include: { variants: true },
  });
  assert(loaded?.isPublished === false, "copy is unpublished");
  assert(loaded?.variants.length === 2, "variants copied");
}

async function testUnpublishPreviewListsSharedCollections() {
  const shared = await prisma.product.create({
    data: {
      name: `${stamp} shared gown`,
      slug: `${stamp}-shared-gown`,
      description: "shared",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      isPublished: true,
    },
  });
  const onlyResort = await prisma.product.create({
    data: {
      name: `${stamp} resort only`,
      slug: `${stamp}-resort-only`,
      description: "resort",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      isPublished: true,
    },
  });
  ids.productIds.push(shared.id, onlyResort.id);
  const resort = await prisma.collection.create({
    data: { name: `${stamp} Resort`, slug: `${stamp}-resort`, isPublished: true },
  });
  const bridal = await prisma.collection.create({
    data: { name: `${stamp} Bridal`, slug: `${stamp}-bridal`, isPublished: true },
  });
  ids.collectionIds.push(resort.id, bridal.id);
  await prisma.collectionProduct.createMany({
    data: [
      { collectionId: resort.id, productId: shared.id },
      { collectionId: resort.id, productId: onlyResort.id },
      { collectionId: bridal.id, productId: shared.id },
    ],
  });

  const impact = await previewUnpublishImpact(resort.id);
  assert(impact.products.length === 2, "both published pieces listed");
  const sharedHit = impact.products.find((p) => p.id === shared.id);
  assert(sharedHit?.otherCollectionNames.includes(`${stamp} Bridal`), "shared piece names Bridal");
  const onlyHit = impact.products.find((p) => p.id === onlyResort.id);
  assert(onlyHit && onlyHit.otherCollectionNames.length === 0, "resort-only has no other collections");
  const msg = formatUnpublishImpactMessage(impact);
  assert(msg.includes(`${stamp} shared gown`), "confirm copy names the piece");
  assert(msg.includes(`${stamp} Bridal`), "confirm copy names the other collection");
}

async function main() {
  setSkipImmediateDeliverForTest(true);
  try {
    await testUnsubscribeExcluded();
    await testDedupe();
    await testCampaignQueuesWithoutSending();
    await testTransactionalWins();
    await testDuplicateProduct();
    await testUnpublishPreviewListsSharedCollections();
    console.log("test:slice-h passed");
  } finally {
    await cleanup();
    setEmailProvidersForTest(null);
    setSkipImmediateDeliverForTest(false);
  }
}

main().catch((e) => {
  console.error(e);
  void cleanup().finally(() => process.exit(1));
});
