# PRUDENTIAL ATELIER — DEMO QUICK-START GUIDE
### Everything you need to run the website for a presentation

---

## STEP 1 — Add Seed Config to package.json

Open your `package.json` and add this `prisma` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "npx tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force && npx tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

Also install tsx (TypeScript runner for seed):
```bash
npm install -D tsx
```

---

## STEP 2 — Run the Seed

```bash
# First time setup:
npx prisma db push          # Push schema to database
npx prisma db seed          # Load all demo data

# OR if using migrations:
npx prisma migrate deploy
npx prisma db seed

# To reset and reseed (wipes all data):
npm run db:reset
```

---

## STEP 3 — What Gets Created

```
👤  4 User Accounts
🚚  5 Shipping Zones
🏷️  6 Coupon Codes
👗  14 Products (54 variants total)
📦  8 Orders (all statuses)
✂️  8 Bespoke Requests (all stages)
⭐  8 Reviews (7 approved, 1 pending)
❤️  7 Wishlist items
🛒  2 Cart items
🔔  2 Stock alerts
💰  9 Points transactions
```

---

## STEP 4 — Login Credentials

### Admin Dashboard → /admin
```
Email:    admin@prudentialatelier.com
Password: Admin@PA2024!
```

### Customer Accounts → /auth/login
```
Customer 1 (Amara) — has orders, points history, 2 referrals
Email:    amara@example.com
Password: Customer@2024

Customer 2 (Chidinma) — was referred, has orders
Email:    chidinma@example.com
Password: Customer@2024

Customer 3 (Folake) — recently joined, has cart items
Email:    folake@example.com
Password: Customer@2024
```

---

## STEP 5 — Coupon Codes to Test at Checkout

| Code | Type | Discount | Condition |
|---|---|---|---|
| `WELCOME10` | % | 10% off | Min ₦30,000, 1 per account |
| `FREESHIP` | Free shipping | Free | Min ₦50,000 |
| `BRIDAL20` | % | 20% off bridal | Min ₦150,000 |
| `FLASH5000` | Fixed | ₦5,000 off | Min ₦80,000, expires 7 days |
| `VIP15` | % | 15% off everything | Up to 5 uses |
| `EXPIRED10` | % | — | Expired — tests error state |

---

## STEP 6 — Product Images

The seed uses **real Unsplash images** that work immediately without configuring Cloudinary.
All product images will display correctly on first run.

When you replace with real brand photography later, simply update the image URLs via the admin dashboard (Products → Edit → Images).

---

## STEP 7 — Presentation Demo Flow

### Storefront Demo:
1. Visit homepage → scroll through all 10 sections
2. Click "Shop The Collection" → see 14 products, use filters
3. Click a product → select a size (watch price update), add to cart
4. Click a sale product (Ebony Evening Dress or Boardroom Midi) → see countdown/crossed price
5. Click the cart → see items, see "You'll earn X points"
6. Proceed to checkout → apply `WELCOME10` coupon → see discount

### Customer Account Demo:
1. Login as amara@example.com / Customer@2024
2. Show dashboard — 3 orders, 2,350 points, 2 referrals
3. Show Wallet page — points history with types
4. Show Referral page — copy the unique link
5. Show Orders — different statuses, timeline view on delivered order

### Admin Demo:
1. Login as admin@prudentialatelier.com / Admin@PA2024!
2. Show analytics dashboard — revenue, orders, charts
3. Show Products → click edit on Amore Bridal Gown → VariantManager (6 sizes with different prices)
4. Show Orders → 8 orders with different statuses
5. Show Bespoke → 8 requests at different stages (PENDING → DELIVERED)
6. Show Coupons → 6 coupons including expired one
7. Show Reviews → 1 pending moderation, approve it live
8. Show Customers → Amara's profile with referral tree

### Referral Demo:
1. Visit: /ref/AMARA-REF-001
2. It redirects to /auth/register?ref=AMARA-REF-001
3. Register new account → see "500 bonus points on signup" banner
4. After registration: Amara earns 250 pts automatically

---

## STEP 8 — Environment Variables for Vercel

Minimum required to get the site running (without payments):
```
DATABASE_URL=              # Neon.tech connection string
DIRECT_URL=                # Neon.tech direct URL
NEXTAUTH_SECRET=           # Run: openssl rand -base64 32
NEXTAUTH_URL=              # https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=       # https://your-app.vercel.app
```

Add these for full functionality:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
RESEND_API_KEY=
OPEN_EXCHANGE_RATES_APP_ID=
```

---

## PRODUCTS CREATED (with categories)

### 🔴 BRIDAL (3 products)
| Name | Sizes | Price Range |
|---|---|---|
| The Amore Bridal Gown | UK8–UK16 + Custom | ₦850,000 – ₦980,000 |
| The Pearl Bridal Suit | XS–XL + Custom | ₦650,000 – ₦750,000 |
| Heritage Traditional Wedding Set | S–XL + Custom | ₦480,000 – ₦580,000 |

### 🌙 EVENING WEAR (3 products)
| Name | Sizes | Price Range | Sale? |
|---|---|---|---|
| The Ebony Evening Dress ⭐ | XS–XL | ₦148,000–₦172,000 | ✅ 20% off (14 days) |
| Celestial Sequin Gown | XS–XL | ₦320,000–₦380,000 | — |
| Crimson Cut-Out Midi | XS–XXL | ₦145,000–₦185,000 | — |

### 💼 FORMAL (2 products)
| Name | Sizes | Price Range | Sale? |
|---|---|---|---|
| The Lagos Power Suit | XS–XXL | ₦145,000–₦190,000 | — |
| Boardroom Midi Dress | XS–XL | ₦76,000–₦88,000 | ✅ 20% off |

### 👒 CASUAL (3 products)
| Name | Sizes | Price Range |
|---|---|---|
| Sunday Brunch Dress | XS–XXL | ₦65,000–₦75,000 |
| Ankara Heritage Coord Set | XS–XXL | ₦78,000–₦92,000 |
| Signature Modest Maxi | S–XXL | ₦85,000–₦100,000 |

### 👧 KIDDIES (2 products)
| Name | Sizes | Price Range |
|---|---|---|
| Mini Princess Ball Gown | Age 2–10 + Custom | ₦45,000–₦65,000 |
| Little Gentleman Suit | Age 2–12 | ₦38,000–₦46,000 |

### 👜 ACCESSORIES (1 product)
| Name | Sizes | Price Range |
|---|---|---|
| The Atelier Signature Clutch | One Size | ₦85,000 (4 colours) |

---

*Prudential Atelier — Demo Data Guide*
*Prepared by Nony | SonsHub Media*
