# CURSOR SESSION PROMPT — SESSION 9
## Shop Redesign · Admin Settings Overhaul · Media Manager · Reviews · Advanced Features
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** All types explicit or derived from Prisma.
> 3. **This session touches DB schema** — run `npx prisma generate` + `npx prisma db push`
>    after schema changes before writing any code that uses new models.
> 4. **Admin settings are SENSITIVE** — payment keys stored in DB must be encrypted
>    at rest using AES-256. Never return raw secret keys to the client.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## WHAT EXISTS (do not rebuild)

### ✅ Complete
- Full storefront, shop, product detail, checkout, account, consultation, bespoke
- Admin dashboard (all management pages, light theme from Session 8)
- Dark mode system, admin login, scroll fixes
- `src/lib/currency.ts`, `src/lib/email.tsx`, `src/lib/payments/*`
- `src/app/api/admin/upload/route.ts` — Cloudinary upload

---

## PRISMA SCHEMA ADDITIONS

Add these models. Run `npx prisma generate && npx prisma db push` after.

```prisma
// ─────────────────────────────────────────
// SITE SETTINGS (key-value store)
// ─────────────────────────────────────────

model SiteSetting {
  id        String   @id @default(cuid())
  key       String   @unique  // e.g. "store_name", "paystack_secret_key"
  value     String   @db.Text // encrypted for sensitive keys
  group     SettingGroup
  label     String            // Human-readable: "Store Name"
  type      SettingType       // text, textarea, password, image, boolean, number, json
  isPublic  Boolean  @default(false) // if true, exposed to frontend via /api/settings/public
  sortOrder Int      @default(0)
  updatedAt DateTime @updatedAt
  updatedBy String?           // userId of last admin who changed it
}

enum SettingGroup {
  STORE          // Store name, address, currency, contact
  PAYMENTS       // Paystack, Flutterwave, Stripe, Monnify keys
  EMAIL          // SMTP/Brevo credentials, from name, from email
  SMS            // SMS gateway credentials, sender ID
  SHIPPING       // Free shipping thresholds per zone
  APPEARANCE     // Logo, favicon, hero images, section images
  SOCIAL         // Instagram, TikTok, Facebook, YouTube handles
  NOTIFICATIONS  // Admin email for alerts, Slack webhook
  LOYALTY        // Points per ₦100, referral pts values
  SEO            // Meta title template, description, OG image
}

enum SettingType {
  TEXT
  TEXTAREA
  PASSWORD    // Encrypted at rest, masked in UI
  IMAGE       // Cloudinary URL
  BOOLEAN
  NUMBER
  JSON        // For complex config
  COLOR
  SELECT
}

// ─────────────────────────────────────────
// MEDIA LIBRARY
// ─────────────────────────────────────────

model MediaItem {
  id          String   @id @default(cuid())
  url         String   // Cloudinary secure_url
  publicId    String   @unique // Cloudinary public_id
  filename    String
  mimeType    String
  width       Int?
  height      Int?
  sizeBytes   Int?
  folder      String   @default("prudent-gabriel")
  alt         String?
  caption     String?
  uploadedBy  String?  // userId
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@index([folder])
}

// ─────────────────────────────────────────
// REVIEW UPDATES (verified buyer only)
// ─────────────────────────────────────────
// Review model already exists — just verify these fields:
// orderId     String?   — verified purchase link
// isVerified  Boolean   @default(false)
// isApproved  Boolean   @default(false)
// helpfulCount Int      @default(0)
```

---

## TASK A — SETTINGS LIBRARY + SEED

### A1 — Settings Library

**Create `src/lib/settings.ts`**:
```typescript
import { prisma } from './prisma'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'prudent-gabriel-settings-key-2024'
const ALGORITHM = 'aes-256-cbc'

// encrypt(text): string — AES-256-CBC encryption
// decrypt(text): string — decryption
// Both use SETTINGS_ENCRYPTION_KEY env var

// getSetting(key: string): Promise<string | null>
//   Fetch from DB, decrypt if SettingType.PASSWORD
//   Cache in memory (Map) with 5-min TTL

// getSettings(group: SettingGroup): Promise<Record<string, string>>
//   Fetch all settings in a group
//   Decrypt PASSWORD fields
//   Return as key-value object

// getPublicSettings(): Promise<Record<string, string>>
//   Fetch all where isPublic: true
//   Return key-value (no encrypted fields ever in public)

// setSetting(key: string, value: string, updatedBy: string): Promise<void>
//   Encrypt if SettingType.PASSWORD
//   Upsert SiteSetting
//   Clear cache for this key

// getImageSetting(key: string, fallback: string): Promise<string>
//   Get image URL from settings, return fallback if not set
//   Used for dynamic images throughout the site
```

### A2 — Add to .env.example

```bash
SETTINGS_ENCRYPTION_KEY=   # 32-char random string for encrypting payment keys in DB
```

### A3 — Seed Default Settings

**Add to `prisma/seed.ts`** (use upsert, run after existing seed):

```typescript
const defaultSettings = [
  // STORE
  { key: 'store_name', value: 'Prudent Gabriel', group: 'STORE', label: 'Store Name', type: 'TEXT', isPublic: true, sortOrder: 1 },
  { key: 'store_tagline', value: 'Luxury Nigerian Fashion', group: 'STORE', label: 'Tagline', type: 'TEXT', isPublic: true, sortOrder: 2 },
  { key: 'store_email', value: 'hello@prudentgabriel.com', group: 'STORE', label: 'Contact Email', type: 'TEXT', isPublic: true, sortOrder: 3 },
  { key: 'store_phone', value: '+234 000 000 0000', group: 'STORE', label: 'Phone Number', type: 'TEXT', isPublic: true, sortOrder: 4 },
  { key: 'store_address', value: 'Lagos, Nigeria', group: 'STORE', label: 'Address', type: 'TEXTAREA', isPublic: true, sortOrder: 5 },
  { key: 'store_currency_default', value: 'NGN', group: 'STORE', label: 'Default Currency', type: 'SELECT', isPublic: true, sortOrder: 6 },
  { key: 'free_shipping_lagos', value: '150000', group: 'STORE', label: 'Free Shipping Threshold — Lagos (₦)', type: 'NUMBER', isPublic: false, sortOrder: 7 },
  { key: 'free_shipping_nigeria', value: '250000', group: 'STORE', label: 'Free Shipping Threshold — Nigeria (₦)', type: 'NUMBER', isPublic: false, sortOrder: 8 },
  
  // PAYMENTS
  { key: 'paystack_public_key', value: '', group: 'PAYMENTS', label: 'Paystack Public Key', type: 'TEXT', isPublic: true, sortOrder: 1 },
  { key: 'paystack_secret_key', value: '', group: 'PAYMENTS', label: 'Paystack Secret Key', type: 'PASSWORD', isPublic: false, sortOrder: 2 },
  { key: 'flutterwave_public_key', value: '', group: 'PAYMENTS', label: 'Flutterwave Public Key', type: 'TEXT', isPublic: true, sortOrder: 3 },
  { key: 'flutterwave_secret_key', value: '', group: 'PAYMENTS', label: 'Flutterwave Secret Key', type: 'PASSWORD', isPublic: false, sortOrder: 4 },
  { key: 'stripe_public_key', value: '', group: 'PAYMENTS', label: 'Stripe Public Key', type: 'TEXT', isPublic: true, sortOrder: 5 },
  { key: 'stripe_secret_key', value: '', group: 'PAYMENTS', label: 'Stripe Secret Key', type: 'PASSWORD', isPublic: false, sortOrder: 6 },
  { key: 'monnify_api_key', value: '', group: 'PAYMENTS', label: 'Monnify API Key', type: 'PASSWORD', isPublic: false, sortOrder: 7 },
  { key: 'monnify_secret_key', value: '', group: 'PAYMENTS', label: 'Monnify Secret Key', type: 'PASSWORD', isPublic: false, sortOrder: 8 },
  { key: 'monnify_contract_code', value: '', group: 'PAYMENTS', label: 'Monnify Contract Code', type: 'TEXT', isPublic: false, sortOrder: 9 },
  
  // EMAIL
  { key: 'email_from_name', value: 'Prudent Gabriel', group: 'EMAIL', label: 'From Name', type: 'TEXT', isPublic: false, sortOrder: 1 },
  { key: 'email_from_address', value: 'hello@prudentgabriel.com', group: 'EMAIL', label: 'From Email', type: 'TEXT', isPublic: false, sortOrder: 2 },
  { key: 'brevo_api_key', value: '', group: 'EMAIL', label: 'Brevo API Key', type: 'PASSWORD', isPublic: false, sortOrder: 3 },
  { key: 'resend_api_key', value: '', group: 'EMAIL', label: 'Resend API Key', type: 'PASSWORD', isPublic: false, sortOrder: 4 },
  { key: 'admin_notification_email', value: 'admin@prudentgabriel.com', group: 'EMAIL', label: 'Admin Notification Email', type: 'TEXT', isPublic: false, sortOrder: 5 },
  
  // SMS
  { key: 'sms_provider', value: 'termii', group: 'SMS', label: 'SMS Provider', type: 'SELECT', isPublic: false, sortOrder: 1 },
  { key: 'sms_api_key', value: '', group: 'SMS', label: 'SMS API Key', type: 'PASSWORD', isPublic: false, sortOrder: 2 },
  { key: 'sms_sender_id', value: 'PrudentGab', group: 'SMS', label: 'SMS Sender ID', type: 'TEXT', isPublic: false, sortOrder: 3 },
  { key: 'sms_order_confirmed', value: 'true', group: 'SMS', label: 'Send SMS on Order Confirmed', type: 'BOOLEAN', isPublic: false, sortOrder: 4 },
  { key: 'sms_order_shipped', value: 'true', group: 'SMS', label: 'Send SMS on Order Shipped', type: 'BOOLEAN', isPublic: false, sortOrder: 5 },
  
  // APPEARANCE — static image overrides
  { key: 'img_hero', value: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600', group: 'APPEARANCE', label: 'Homepage Hero Image', type: 'IMAGE', isPublic: true, sortOrder: 1 },
  { key: 'img_bride_hero', value: 'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=1600', group: 'APPEARANCE', label: 'Prudential Bride Hero Image', type: 'IMAGE', isPublic: true, sortOrder: 2 },
  { key: 'img_bride_portrait', value: 'https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800', group: 'APPEARANCE', label: 'Prudential Bride Portrait', type: 'IMAGE', isPublic: true, sortOrder: 3 },
  { key: 'img_bespoke', value: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800', group: 'APPEARANCE', label: 'Bespoke Section Image', type: 'IMAGE', isPublic: true, sortOrder: 4 },
  { key: 'img_atelier_wide', value: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200', group: 'APPEARANCE', label: 'Atelier Story Wide Image', type: 'IMAGE', isPublic: true, sortOrder: 5 },
  { key: 'img_atelier_portrait', value: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', group: 'APPEARANCE', label: 'Atelier Story Portrait Image', type: 'IMAGE', isPublic: true, sortOrder: 6 },
  { key: 'img_consultation_hero', value: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600', group: 'APPEARANCE', label: 'Consultation Page Hero', type: 'IMAGE', isPublic: true, sortOrder: 7 },
  { key: 'img_bespoke_hero', value: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600', group: 'APPEARANCE', label: 'Bespoke Page Hero', type: 'IMAGE', isPublic: true, sortOrder: 8 },
  { key: 'img_collection_bridal', value: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800', group: 'APPEARANCE', label: 'Collections Grid — Bridal', type: 'IMAGE', isPublic: true, sortOrder: 9 },
  { key: 'img_collection_evening', value: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', group: 'APPEARANCE', label: 'Collections Grid — Evening', type: 'IMAGE', isPublic: true, sortOrder: 10 },
  { key: 'img_collection_formal', value: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', group: 'APPEARANCE', label: 'Collections Grid — Formal', type: 'IMAGE', isPublic: true, sortOrder: 11 },
  { key: 'img_collection_rtw', value: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800', group: 'APPEARANCE', label: 'Collections Grid — RTW', type: 'IMAGE', isPublic: true, sortOrder: 12 },
  { key: 'img_our_story_hero', value: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400', group: 'APPEARANCE', label: 'Our Story Hero', type: 'IMAGE', isPublic: true, sortOrder: 13 },
  { key: 'favicon_url', value: '/images/logo.svg', group: 'APPEARANCE', label: 'Favicon URL', type: 'IMAGE', isPublic: true, sortOrder: 14 },
  
  // SOCIAL
  { key: 'social_instagram', value: '@prudent_gabriel', group: 'SOCIAL', label: 'Instagram Handle', type: 'TEXT', isPublic: true, sortOrder: 1 },
  { key: 'social_tiktok', value: '@prudentgabriel', group: 'SOCIAL', label: 'TikTok Handle', type: 'TEXT', isPublic: true, sortOrder: 2 },
  { key: 'social_facebook', value: 'prudentgabriel', group: 'SOCIAL', label: 'Facebook Page', type: 'TEXT', isPublic: true, sortOrder: 3 },
  { key: 'social_youtube', value: '', group: 'SOCIAL', label: 'YouTube Channel', type: 'TEXT', isPublic: true, sortOrder: 4 },
  { key: 'social_whatsapp', value: '', group: 'SOCIAL', label: 'WhatsApp Business Number', type: 'TEXT', isPublic: true, sortOrder: 5 },
  
  // LOYALTY
  { key: 'points_per_100_naira', value: '1', group: 'LOYALTY', label: 'Points per ₦100 spent', type: 'NUMBER', isPublic: false, sortOrder: 1 },
  { key: 'points_referral_referrer', value: '250', group: 'LOYALTY', label: 'Points for referrer on signup', type: 'NUMBER', isPublic: false, sortOrder: 2 },
  { key: 'points_referral_new_user', value: '500', group: 'LOYALTY', label: 'Points for new referred user', type: 'NUMBER', isPublic: false, sortOrder: 3 },
  { key: 'points_review', value: '50', group: 'LOYALTY', label: 'Points for leaving a review', type: 'NUMBER', isPublic: false, sortOrder: 4 },
  
  // SEO
  { key: 'seo_title_template', value: '%s | Prudent Gabriel', group: 'SEO', label: 'Page Title Template (%s = page name)', type: 'TEXT', isPublic: true, sortOrder: 1 },
  { key: 'seo_default_description', value: 'Luxury Nigerian fashion — bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Ships worldwide.', group: 'SEO', label: 'Default Meta Description', type: 'TEXTAREA', isPublic: true, sortOrder: 2 },
  { key: 'seo_og_image', value: '', group: 'SEO', label: 'Default OG Share Image', type: 'IMAGE', isPublic: true, sortOrder: 3 },
  
  // NOTIFICATIONS
  { key: 'notify_new_order', value: 'true', group: 'NOTIFICATIONS', label: 'Email on new order', type: 'BOOLEAN', isPublic: false, sortOrder: 1 },
  { key: 'notify_new_bespoke', value: 'true', group: 'NOTIFICATIONS', label: 'Email on new bespoke request', type: 'BOOLEAN', isPublic: false, sortOrder: 2 },
  { key: 'notify_new_consultation', value: 'true', group: 'NOTIFICATIONS', label: 'Email on new consultation booking', type: 'BOOLEAN', isPublic: false, sortOrder: 3 },
  { key: 'notify_low_stock', value: 'true', group: 'NOTIFICATIONS', label: 'Email when variant stock ≤ lowStockAt', type: 'BOOLEAN', isPublic: false, sortOrder: 4 },
  { key: 'slack_webhook_url', value: '', group: 'NOTIFICATIONS', label: 'Slack Webhook URL (for alerts)', type: 'PASSWORD', isPublic: false, sortOrder: 5 },
]

for (const setting of defaultSettings) {
  await prisma.siteSetting.upsert({
    where: { key: setting.key },
    update: {},  // don't overwrite existing values on reseed
    create: setting,
  })
}
```

---

## TASK B — SETTINGS & MEDIA API ROUTES

### B1 — Public Settings API

**`src/app/api/settings/public/route.ts`** (GET)
```typescript
// Returns all SiteSettings where isPublic: true
// As flat key-value object: { store_name: "Prudent Gabriel", img_hero: "...", ... }
// Cache: revalidate 300 (5 min)
// Never return PASSWORD type settings even if isPublic somehow set
```

### B2 — Admin Settings API

**`src/app/api/admin/settings/route.ts`** (GET)
```typescript
// Returns settings grouped by SettingGroup
// PASSWORD fields: return masked value "••••••••" (never the real value)
// Role check: ADMIN or SUPER_ADMIN only
```

**`src/app/api/admin/settings/[group]/route.ts`** (GET, PATCH)
```typescript
// GET: All settings for a group, passwords masked
// PATCH: Body: { key: string, value: string }[]
//   For each: call setSetting(key, value, userId)
//   PASSWORD fields: encrypt before saving
//   After save: if payment key changed, note in response that
//               app restart may be needed for env-var-based clients
//   Return: { success: true, updated: number }
```

### B3 — Media Library API

**`src/app/api/admin/media/route.ts`** (GET, POST)
```typescript
// GET: paginated media items (20 per page)
//   Query: folder, search (filename), page
//   Return: { items: MediaItem[], total, page, totalPages }

// POST: Upload new media
//   Accepts multipart form data (file)
//   Upload to Cloudinary folder: 'prudent-gabriel/[folder]'
//   Save MediaItem to DB with url, publicId, filename, mimeType, width, height, sizeBytes
//   Return: MediaItem
```

**`src/app/api/admin/media/[id]/route.ts`** (PATCH, DELETE)
```typescript
// PATCH: Update alt text and caption
// DELETE: Delete from Cloudinary (cloudinary.uploader.destroy(publicId))
//         Then delete MediaItem from DB
```

---

## TASK C — ADMIN SETTINGS PAGE (FULL REBUILD)

**Replace `src/app/(admin)/admin/settings/page.tsx`** with a full settings management page.

```
LAYOUT: Tabbed interface (Radix Tabs)

TAB NAVIGATION (left vertical tabs on desktop, top horizontal on mobile):
  📦 Store
  💳 Payments
  📧 Email & SMS
  🖼️  Appearance
  🔗 Social Media
  ⭐ Loyalty & Points
  🔔 Notifications
  🔍 SEO
  📁 Media Library

Each tab = a settings group from DB
```

### C1 — Store Settings Tab
```
Card: white, border, padding 24px

Fields rendered dynamically from DB (SettingGroup.STORE):
  Store Name (text input)
  Tagline (text input)
  Contact Email (text input)
  Phone Number (text input)
  Address (textarea)
  Default Currency (select: NGN / USD / GBP)
  Free Shipping — Lagos (₦ number input)
  Free Shipping — Nigeria (₦ number input)

[Save Store Settings] button (olive, bottom)
On save: PATCH /api/admin/settings/STORE
Toast: "Store settings saved ✓"
```

### C2 — Payments Settings Tab
```
SECURITY WARNING BANNER (amber, top):
  "⚠️ Payment keys are encrypted and stored securely.
   They are never exposed in the browser. Changes take effect immediately."

4 gateway sections (collapsible accordion cards):

PAYSTACK:
  Public Key (text — shown)
  Secret Key (password — masked, show/hide toggle)
  [Test Connection] button → POST /api/admin/settings/test-payment { gateway: 'paystack' }
    Makes a test API call to Paystack, returns success/failure
  Status indicator: 🟢 Connected / 🔴 Not configured

FLUTTERWAVE:
  Same pattern

STRIPE:
  Public Key, Secret Key, Webhook Secret

MONNIFY:
  API Key, Secret Key, Contract Code, Environment (sandbox/production toggle)

[Save Payment Settings] button
```

### C3 — Email & SMS Tab
```
EMAIL SECTION:
  From Name (text)
  From Email (text)
  Email Provider (radio: Resend / Brevo / SMTP)
  
  If Resend: Resend API Key (password)
  If Brevo: Brevo API Key (password)
  If SMTP:
    SMTP Host, Port, Username, Password (password), SSL toggle
  
  Admin Notification Email (text)
  
  [Send Test Email] button → sends a test email to admin email
  
  EMAIL TEMPLATES SECTION:
    List of all email templates:
      Welcome Email
      Order Confirmation
      Order Shipped
      Bespoke Confirmation
      Password Reset
      Referral Success
      Back In Stock
      Consultation Pending
      Consultation Confirmed
      Consultation Cancelled
    
    Click [Edit] on any template → opens TemplateEditor:
      Subject line (text input)
      Body (rich textarea — NOT Tiptap, just a plain textarea for now)
      Preview button → shows rendered HTML
      Available variables shown below editor:
        {{firstName}}, {{orderNumber}}, {{productName}} etc.
      [Save Template] → stores in DB as SiteSetting with key "email_tpl_[name]"
      Note: "Templates use default if not customised here."

SMS SECTION:
  SMS Provider (select: Termii / Twilio / Africa's Talking)
  API Key (password)
  Sender ID (text, max 11 chars)
  
  Toggles:
    Send SMS on Order Confirmed
    Send SMS on Order Shipped
    Send SMS on Consultation Confirmed
  
  [Send Test SMS] button → sends test to admin phone

[Save Email & SMS] button
```

### C4 — Appearance Tab
```
HEADING: "Site Images"
SUBTEXT: "Replace any static image on the website. 
          Click an image to upload a new one from your device or choose from the Media Library."

IMAGE GRID (2-col desktop):
  Each image setting renders as:
    ┌────────────────────────────────────┐
    │  [Image preview: 200px × 140px]   │
    │  Label: "Homepage Hero Image"      │
    │  [Upload New] [From Library]       │
    └────────────────────────────────────┘
  
  [Upload New]: triggers file picker → uploads to Cloudinary → updates setting
  [From Library]: opens MediaPickerModal
  
  Hover on image: overlay with "Change Image" text

[Save Appearance] button
```

### C5 — Social Media Tab
```
Simple form: Instagram, TikTok, Facebook, YouTube, WhatsApp
[Save Social Settings] button
```

### C6 — Loyalty & Points Tab
```
4 number inputs with explanatory notes:
  Points per ₦100 spent: [1] "Customers earn X points per ₦100"
  Referrer signup bonus: [250] "Referrer earns X pts when friend joins"
  New user signup bonus: [500] "New user receives X pts on first login via referral"
  Review points: [50] "Customer earns X pts for a verified review"

[Save Loyalty Settings] button

NOTE BELOW:
  "Changes apply to future transactions only. Existing points are not affected."
```

### C7 — Notifications Tab
```
Toggle list:
  Email on new order
  Email on new bespoke request
  Email on new consultation booking
  Email when variant low stock
  Slack alert on new order (requires webhook below)

Slack Webhook URL (password input, optional):
  [Test Slack] button

[Save Notification Settings]
```

### C8 — SEO Tab
```
Page Title Template (text, default "%s | Prudent Gabriel")
Default Meta Description (textarea, max 160 chars, char counter)
Default OG Share Image (image picker)

Preview box:
  Simulated Google result with current values

[Save SEO Settings]
```

### C9 — Media Library Tab
```
This is a FULL media manager built into the settings page.

TOOLBAR:
  Search (filename)
  Folder filter (All, Products, Brand, Blog)
  [Upload Files] button (multi-file, drag-and-drop)
  View: Grid / List toggle

GRID VIEW (4-col desktop, 2-col mobile):
  Each item:
    Image preview (aspect 1:1, object-cover)
    Filename (truncated)
    Date uploaded
    File size
    On hover: checkbox (multi-select), [Copy URL] icon, [Delete] icon
  
  Click item → MediaDetailPanel (right side drawer):
    Full preview
    Filename, URL (copyable), dimensions, size
    Alt text input (editable, saves on blur)
    Caption input
    [Copy URL] button → copies to clipboard, toast "URL copied ✓"
    [Delete] button (with confirm)

LIST VIEW:
  Table: thumbnail 40px | filename | folder | size | date | actions

PAGINATION: 20 per page

MULTI-SELECT:
  Checkbox on each item
  Bulk action bar when selected: [Delete Selected] | [Download URLs as CSV]
```

---

## TASK D — USE SETTINGS IN STOREFRONT IMAGES

### D1 — Settings Context

**Create `src/hooks/usePublicSettings.ts`**:
```typescript
// Client hook that fetches /api/settings/public once on mount
// Caches in module-level variable (not re-fetched per component)
// Returns: Record<string, string>
// Provides getSetting(key: string, fallback: string): string helper
```

### D2 — Server-side settings helper

**In `src/lib/settings.ts`** add:
```typescript
// getImageSettings(): Promise<Record<string, string>>
//   For server components — fetch all APPEARANCE group settings
//   Returns key-value of image URLs
//   Used in page.tsx server components to pass dynamic images down
```

### D3 — Wire images into homepage

**Update `src/app/(storefront)/page.tsx`**:
```typescript
// Server component — fetch image settings:
const images = await getImageSettings()

// Pass to components:
<Hero heroImage={images.img_hero} />
<PrudentialBride
  heroImage={images.img_bride_hero}
  portraitImage={images.img_bride_portrait}
/>
<BespokeCouture bespokeImage={images.img_bespoke} />
<AtelierStory
  wideImage={images.img_atelier_wide}
  portraitImage={images.img_atelier_portrait}
/>
<CollectionsGrid
  bridalImage={images.img_collection_bridal}
  eveningImage={images.img_collection_evening}
  formalImage={images.img_collection_formal}
  rtwImage={images.img_collection_rtw}
/>
```

Each component must accept these as props with the Unsplash URLs as fallback defaults.

**Wire similarly into:**
- `src/app/(storefront)/bespoke/page.tsx` → `img_bespoke_hero`
- `src/app/(storefront)/consultation/page.tsx` → `img_consultation_hero`
- `src/app/(storefront)/our-story/page.tsx` → `img_our_story_hero`

---

## TASK E — SHOP PAGE COMPLETE REDESIGN

### E1 — Shop Layout Change

**Update `src/app/(storefront)/shop/page.tsx`**:

```
REMOVE the persistent left sidebar layout.
Replace with:
  - Full-width product grid
  - Filter panel hidden by default
  - "FILTER" button in topbar opens FilterDrawer (slides from left)

TOPBAR (sticky, bg-white, border-bottom 1px solid mid-grey, h-12):
  Left: [≡ FILTER] button (Jost 11px uppercase, Lucide SlidersHorizontal icon)
  Center: "Showing X pieces" (Jost 11px, dark-grey)
  Right: Sort select (Jost 11px, inline, no box — dropdown only)
         [≡ GRID / □ LIST] view toggle (grid is default)
```

### E2 — Product Grid Redesign

```
GRID: No sidebar. Full width. max-w-[1400px] mx-auto px-6
  Desktop (lg+): 3 columns
  Tablet (md):   2 columns
  Mobile:        2 columns
  Gap: 2px (tight editorial gap — images flush against each other)

NO padding inside grid items. Images are full-bleed to the gap.
```

### E3 — ProductCard Complete Redesign

**Update `src/components/common/ProductCard.tsx`**:

```typescript
// This is the most important component. Every detail matters.

CONTAINER:
  group, cursor-pointer, bg-white
  No border, no shadow, no padding around image

IMAGE SECTION (aspect-[3/4], overflow-hidden, relative):

  PRIMARY IMAGE: next/image fill object-cover object-top
  
  SECONDARY IMAGE (hover crossfade):
    absolute inset-0, next/image fill object-cover object-top
    opacity-0 → opacity-100 on group-hover (transition-opacity 600ms ease)
    Only renders if product.images[1] exists
    If no second image: primary image zooms in slightly instead:
      group-hover:scale-105 transition-transform 600ms ease
  
  TOP-LEFT BADGES (absolute top-3 left-3, flex flex-col gap-1):
    SALE: "SALE" — bg-olive text-white, Jost 9px uppercase, px-2 py-0.5, NO border-radius
    NEW:  "NEW"  — bg-black text-white, same style
    Max 1 badge shown (SALE takes priority)
  
  TOP-RIGHT: WishlistButton (heart, 32px touch target)
  
  QUICK BUY PANEL (slides up from bottom on group-hover):
    Position: absolute bottom-0 left-0 right-0
    Background: white/95 backdrop-blur-sm
    Padding: 16px
    Transform: translateY(100%) → translateY(0) on group-hover
    Transition: transform 350ms cubic-bezier(0.25, 0.1, 0.25, 1)
    
    CONTENT:
      If product has only ONE size OR size is "One Size":
        [ADD TO BAG] button — full width, bg-olive, white, Jost 11px uppercase, h-10
        onClick: cartStore.addItem() directly (no modal needed)
      
      If product has MULTIPLE sizes:
        Size chips row (flex gap-1, mb-2):
          Each available size: small chip (Jost 10px, border 1px mid-grey, px-2 py-1)
          Selected: olive bg, white
          OOS: opacity-40, line-through
          Click chip: selects size
        
        [ADD TO BAG] — full width, olive, disabled until size selected
        [QUICK VIEW →] — ghost link, centers, Jost 10px, opens QuickViewModal
        
      The panel must be smooth. Never janky. 600ms ease.

INFO SECTION (padding: 14px 0 20px):
  
  Product name:
    Jost 14px weight-400, charcoal, line-clamp-1
    hover: color olive, transition 200ms
  
  PRICE ROW (flex items-center gap-2, mt-1):
    On sale:
      <del className="text-[13px] text-dark-grey font-light"> ₦[original] </del>
      <span className="text-[14px] text-olive font-medium"> ₦[sale] </span>
    Not on sale:
      <span className="text-[14px] text-charcoal font-light">
        {hasMultipleVariants ? 'From ' : ''} ₦[price]
      </span>
  
  COLOR DOTS (if product has colors, mt-2):
    Flex row, gap-1.5
    Each: 10px circle, bg=[hex], ring-1 ring-[var(--mid-grey)]
    On hover: ring-charcoal
    Max 4 shown, "+N" text if more
    Clicking a dot updates the image shown in the card
      (if that color has a colorImage URL, switch primary image to it)
```

### E4 — Filter Sidebar (Drawer version)

**Update `src/components/shop/FilterDrawer.tsx`**:

```
Slides from LEFT (not bottom — desktop and mobile both)
Width: 300px desktop, full-width mobile
Background: white
Border-right: 1px solid mid-grey (desktop)

HEADER:
  "FILTER" (Jost 11px uppercase tracking, black) + [×] close (right)
  Border-bottom: 1px solid mid-grey, padding 20px

FILTER SECTIONS (overflow-y-auto, padding 20px):
  
  Each section: border-bottom 1px solid mid-grey, padding: 16px 0
  Section label: Jost 10px uppercase tracking, dark-grey, mb-3
  
  SORT (radio group):
    Newest · Price: Low to High · Price: High to Low · Featured
    Each: flex items-center gap-2, Jost 13px charcoal
    Radio: olive when selected
  
  CATEGORY (checkbox group):
    All · Bridal · Evening Wear · Formal · Casual · Kiddies · Accessories
    Each: flex items-center gap-2, Jost 13px
    Checkbox: olive when checked
  
  TYPE (radio):
    All · Ready-to-Wear · Bespoke
  
  PRICE RANGE:
    Radix Slider: 0 to ₦1,000,000
    Display: "₦0 — ₦1,000,000" (updates as dragged)
    Track: olive fill
  
  SIZE (chip grid):
    XS S M L XL XXL UK8 UK10 UK12 Custom
    Each chip: Jost 11px, border 1px mid-grey, px-3 py-1
    Selected: bg-olive text-white border-olive
    NO border-radius
  
  SALE ONLY: toggle switch + "Show sale items only" label
  IN STOCK: toggle switch + "In stock only" (default on)

FOOTER (sticky bottom, border-top, padding 16px):
  [CLEAR ALL] text button (Jost 12px, dark-grey, left)
  [APPLY FILTERS] button (olive, full-width, Jost 11px uppercase, h-10)
```

### E5 — Active Filters Display

**Update `src/components/shop/ActiveFilters.tsx`**:

```
Horizontal scrollable row of filter pills (below topbar)
Only shows when filters are active

Each pill: Jost 11px, border 1px olive, olive text, px-3 py-1
           [filter label] + [×] to remove
           NO border-radius

"Clear all" link at end if > 1 filter active
```

### E6 — Product Placeholder Image

When product has no images (broken/missing), show a branded placeholder:

```typescript
// In ProductCard.tsx and ProductGallery.tsx:
const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' 
  width='800' height='1067' viewBox='0 0 800 1067'%3E
  %3Crect width='100%25' height='100%25' fill='%23F2F2F0'/%3E
  %3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'
    font-family='Georgia' font-size='14' fill='%23A8A8A4' letter-spacing='4'%3EPRUDENT GABRIEL%3C/text%3E
  %3C/svg%3E`

// Use as fallback:
src={product.images[0]?.url || PLACEHOLDER_SVG}
```

---

## TASK F — VERIFIED BUYER REVIEW SYSTEM

### F1 — Review API

**`src/app/api/reviews/route.ts`** (POST — update existing):
```typescript
// Auth required (must be logged in)
// Body: { productId, rating, title?, body }
// Validate rating 1-5, body min 10 chars

// VERIFIED BUYER CHECK:
//   Query: prisma.orderItem.findFirst({
//     where: {
//       productId,
//       order: { userId: session.user.id, paymentStatus: 'PAID' }
//     }
//   })
//   If found: create review with isVerified: true, orderId: order.id
//   If NOT found: return 403 { error: "Only verified buyers can review this product" }

// DUPLICATE CHECK:
//   Check if user already reviewed this product → return 409 if so

// CREATE REVIEW: isApproved: false (admin must approve)

// AWARD POINTS (if verified):
//   Award 50 points (or getSetting('points_review') value from DB)
//   PointsTransaction type: EARNED_REVIEW

// Return: { success: true, message: "Review submitted for approval" }
```

**`src/app/api/reviews/[id]/helpful/route.ts`** (POST — update existing):
```typescript
// Increment helpfulCount by 1
// Rate limit: once per user per review (store in localStorage client-side)
```

### F2 — Review Form in Product Detail

**Update `src/components/product/ReviewForm.tsx`**:

```
GATE CHECK: Before showing form, check:
  GET /api/reviews/eligibility?productId=[id]
  Returns: { canReview: boolean, reason?: string, hasReviewed: boolean }

If canReview = false:
  Show message: "Only verified buyers can review this product.
                 [Purchase this item] to leave a review."

If hasReviewed = true:
  Show: "You have already reviewed this product."

If canReview = true:
  Show full review form:
  
  Star Rating (interactive, click to set, hover to preview):
    5 large stars (24px), olive when filled, mid-grey when empty
    Click star → sets rating
    Required before submit
  
  Title (Input, optional, max 80 chars):
    Placeholder: "Summarise your experience"
  
  Body (Textarea, required, min 10 chars, max 1000):
    Placeholder: "Tell others about the fit, quality, and delivery..."
    Char counter
  
  [SUBMIT REVIEW] button (olive, full-width)
    Loading state
  
  Success: replace form with:
    "✓ Review submitted! It will appear after our team approves it."
    "You've earned 50 loyalty points for this review 🌟" (if points awarded)
```

**Add eligibility API route:**
**`src/app/api/reviews/eligibility/route.ts`** (GET):
```typescript
// Query: productId
// Auth required
// Check: has PAID order containing this product
// Check: has already reviewed
// Return: { canReview: boolean, hasReviewed: boolean, reason?: string }
```

### F3 — Reviews Display Update

**Update `src/components/product/ReviewsSection.tsx`**:

```
RATING SUMMARY (if reviews exist):
  Large number: averageRating (Bodoni Moda 48px, olive)
  Star row below (5 stars, olive)
  "Based on [N] verified reviews" (Jost 12px, dark-grey)
  
  Rating bars (5→1):
    "[N]★" | ▬▬▬▬▬▬▬▬▬ (fill %) | [count]
    Bar: olive fill, mid-grey bg, height 4px, NO border-radius

WRITE REVIEW BUTTON:
  "WRITE A REVIEW" — outlined, olive border, olive text, Jost 11px uppercase
  Opens ReviewForm (checks eligibility first)

REVIEWS LIST:
  Sort: Newest / Most Helpful (toggle)
  
  Each review card (border-bottom 1px mid-grey, py-5):
    TOP ROW: Stars (small) + "VERIFIED PURCHASE" badge (Jost 9px, olive outlined) + date
    TITLE: Jost 14px weight-500 black
    BODY: Jost 14px weight-300 charcoal, line-height 1.75
    FOOTER: "[Name]" (first name + last initial) + "Helpful? 👍 [N]" button
    
    Helpful button: Jost 11px, dark-grey, hover olive
    Click: POST /api/reviews/[id]/helpful (once per session)
```

---

## TASK G — CUSTOMER ACCOUNT DARK MODE TOGGLE

The dark mode toggle is in the navbar (done in Session 8).
Add it also in the customer account profile page:

**Update `src/app/(account)/account/profile/page.tsx`**:

```
Add a "PREFERENCES" section below the security card:

PREFERENCES CARD (bg-cream, border, p-5):
  Title: "Display Preferences" (Jost 11px uppercase tracking, dark-grey)
  
  Row: flex justify-between items-center
    Left: 
      "Dark Mode" (Jost 14px, charcoal)
      "Switch between light and dark appearance" (Jost 12px, dark-grey, mt-0.5)
    Right: DarkModeToggle component (the existing toggle from Session 8)
  
  Note below (Jost 11px, dark-grey):
    "Your preference is saved automatically."
```

---

## TASK H — SHOP PAGE PERFORMANCE

### H1 — Product image quality
```typescript
// In ProductCard, use Cloudinary transformation for optimized sizes:
// For thumbnails in grid: q_auto,f_auto,w_600,c_fill,g_top
// For hover secondary: same transformation

// If using Unsplash (placeholder), add &w=600&q=80 to URL
// This prevents loading 1600px images in a 300px card
```

### H2 — Infinite scroll option
```typescript
// In shop/page.tsx, replace pagination with infinite scroll:
// Use Intersection Observer (no library needed)
// When last product card enters viewport: fetch next page
// Append to existing products (don't replace)
// Show "Loading more..." skeleton at bottom
// When no more pages: "Showing all [N] pieces" message

// IMPLEMENTATION:
// Client component wrapper for the grid + infinite scroll
// Server component fetches initial page only
```

---

## TASK I — ADMIN DARK/LIGHT MODE TOGGLE IN ADMIN

Add a subtle toggle to admin topbar for admin's own viewing preference:

**Update `src/components/admin/AdminTopbar.tsx`**:
```typescript
// Add DarkModeToggle to right section of topbar
// But: admin area CSS vars are always reset to light (via .admin-area in tokens.css)
// So the toggle affects the STOREFRONT only, not admin itself
// Add a tooltip: "Toggle storefront dark mode"
// This lets admin preview what customers see in dark mode
```

---

## FINAL CHECKS

```bash
npx prisma generate
npx prisma db push
npx prisma db seed    # seeds default settings
npx tsc --noEmit      # must pass
npx next build        # must pass
```

Verify:
```
/shop → redesigned product grid, no sidebar, filter button works
/shop → hover a product → secondary image crossfades OR primary zooms
/shop → hover → quick buy panel slides up from bottom
/admin/settings → tabbed settings page loads
/admin/settings → Appearance tab shows all image slots
/admin/settings → Media Library tab shows upload + grid
/admin/settings → Payments tab shows gateway sections
/shop/[slug] → "Write a Review" only appears for logged-in verified buyers
/account/profile → Preferences section with dark mode toggle
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 9 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — SiteSetting model + seed (50+ default settings)
✅ Task B — Settings API + Media Library API
✅ Task C — Admin Settings page (8 tabs: Store, Payments, Email/SMS, Appearance, Social, Loyalty, Notifications, SEO, Media)
✅ Task D — Dynamic images wired from settings into all storefront pages
✅ Task E — Shop page redesign (grid, ProductCard with hover swap + quick buy)
✅ Task F — Verified buyer review system
✅ Task G — Dark mode toggle in account profile
✅ Task H — Shop performance (image optimization, infinite scroll)
✅ Task I — Dark mode toggle in admin topbar

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 9*
*Prepared by Nony | SonsHub Media*
