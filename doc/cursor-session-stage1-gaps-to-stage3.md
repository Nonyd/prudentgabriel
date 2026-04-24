# CURSOR SESSION PROMPT
## Prudential Atelier — Close Stage 1 Gaps → Audit Stage 2 → Begin Stage 3
### Reference: `doc/prudential-atelier-cursor-prompt-v2.md`

---

> **CURSOR OPERATING RULES FOR THIS SESSION:**
> 1. Work through Tasks A → B → C in strict order.
> 2. After each Task, output a **"✅ TASK [X] COMPLETE"** summary listing every file created or modified.
> 3. Never silently skip a step. If something already exists and is correct, say "Already correct — no change."
> 4. Never remove working code that isn't mentioned in this prompt.
> 5. The master spec is `doc/prudential-atelier-cursor-prompt-v2.md`. When in doubt, it is the source of truth.

---

## TASK A — CLOSE ALL STAGE 1 GAPS

The repo has partially implemented Stage 1. The following are confirmed gaps. Fix each one exactly.

---

### A.1 — Install Missing Dependencies

Run this single command in the terminal. Do **not** reinstall packages already present.
Check `package.json` first and only add what is genuinely missing:

```bash
npm install \
  @tanstack/react-query \
  @tanstack/react-table \
  @radix-ui/react-checkbox \
  @radix-ui/react-tooltip \
  @radix-ui/react-popover \
  recharts \
  @tiptap/react \
  @tiptap/starter-kit \
  @tiptap/extension-placeholder \
  react-intersection-observer \
  react-countup \
  react-hot-toast \
  react-easy-crop \
  canvas-confetti \
  @types/canvas-confetti
```

After install, confirm all packages appear in `package.json`. If any install fails individually, install them one by one and report which failed.

---

### A.2 — Create `src/styles/tokens.css`

Create this file with **exactly** these CSS custom properties.
Do not put these variables in `globals.css` directly — they live in their own file:

```css
/* src/styles/tokens.css */
:root {
  /* ── Brand Colors ── */
  --wine:           #6B1C2A;
  --wine-hover:     #7D2233;
  --wine-dark:      #4A1019;
  --wine-muted:     rgba(107, 28, 42, 0.10);

  --gold:           #C9A84C;
  --gold-hover:     #D9BB62;
  --gold-muted:     rgba(201, 168, 76, 0.15);
  --gold-dark:      #A8893A;

  --ivory:          #FAF6EF;
  --ivory-dark:     #F0E8D8;
  --ivory-deeper:   #E8D9C0;

  --charcoal:       #1A1A1A;
  --charcoal-mid:   #3D3D3D;
  --charcoal-light: #6B6B6B;

  --cream:          #FEFAF3;
  --border:         #E8DDD0;
  --border-dark:    #C8B89A;

  /* ── Semantic Colors ── */
  --success:        #2D6A4F;
  --error:          #C1121F;
  --warning:        #E76F51;
  --info:           #457B9D;

  /* ── Typography ── */
  --font-display:   'Cormorant Garamond', Georgia, serif;
  --font-body:      'DM Sans', system-ui, sans-serif;
  --font-label:     'Cormorant SC', Georgia, serif;

  /* ── Spacing Scale ── */
  --space-xs:       4px;
  --space-sm:       8px;
  --space-md:       16px;
  --space-lg:       24px;
  --space-xl:       40px;
  --space-2xl:      64px;
  --space-3xl:      96px;
  --space-4xl:      128px;

  /* ── Border Radius ── */
  --radius-sm:      2px;
  --radius-md:      4px;
  --radius-lg:      8px;
  --radius-xl:      16px;

  /* ── Shadows ── */
  --shadow-sm:      0 1px 3px rgba(26, 26, 26, 0.08);
  --shadow-md:      0 4px 16px rgba(26, 26, 26, 0.10);
  --shadow-lg:      0 8px 40px rgba(26, 26, 26, 0.14);
  --shadow-gold:    0 4px 24px rgba(201, 168, 76, 0.20);

  /* ── Transitions ── */
  --ease:           cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-out:       cubic-bezier(0, 0, 0.2, 1);
  --duration:       300ms;
}
```

---

### A.3 — Update `src/styles/globals.css`

Open the existing `globals.css`. Make the following changes **without removing what's already there**:

1. Add this `@import` as the **very first line** of the file (before any other imports or rules):
   ```css
   @import './tokens.css';
   ```

2. Ensure the following base styles exist (add only what's missing):
   ```css
   html {
     scroll-behavior: smooth;
     font-size: 16px;
   }

   body {
     font-family: var(--font-body);
     background-color: var(--ivory);
     color: var(--charcoal);
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
   }

   ::selection {
     background-color: var(--wine);
     color: var(--ivory);
   }

   /* Custom Scrollbar */
   ::-webkit-scrollbar {
     width: 8px;
   }
   ::-webkit-scrollbar-track {
     background: var(--ivory);
   }
   ::-webkit-scrollbar-thumb {
     background: var(--wine);
     border-radius: 4px;
   }
   ::-webkit-scrollbar-thumb:hover {
     background: var(--wine-hover);
   }

   /* Lenis smooth scroll */
   html.lenis {
     height: auto;
   }
   .lenis.lenis-smooth {
     scroll-behavior: auto;
   }
   .lenis.lenis-smooth [data-lenis-prevent] {
     overscroll-behavior: contain;
   }
   ```

---

### A.4 — Update `tailwind.config.ts`

Open the existing config. Merge in the following — do not erase existing values, only add/update:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Fonts ──
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body:    ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        label:   ['var(--font-cormorant-sc)', 'Georgia', 'serif'],
      },

      // ── Colors (map to CSS variables) ──
      colors: {
        wine: {
          DEFAULT: 'var(--wine)',
          hover:   'var(--wine-hover)',
          dark:    'var(--wine-dark)',
          muted:   'var(--wine-muted)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          hover:   'var(--gold-hover)',
          dark:    'var(--gold-dark)',
          muted:   'var(--gold-muted)',
        },
        ivory: {
          DEFAULT: 'var(--ivory)',
          dark:    'var(--ivory-dark)',
          deeper:  'var(--ivory-deeper)',
        },
        charcoal: {
          DEFAULT: 'var(--charcoal)',
          mid:     'var(--charcoal-mid)',
          light:   'var(--charcoal-light)',
        },
        cream:   'var(--cream)',
        border:  'var(--border)',
      },

      // ── Custom Animations ──
      animation: {
        'shimmer':    'shimmer 2s linear infinite',
        'fade-up':    'fadeUp 0.7s var(--ease-out) forwards',
        'fade-in':    'fadeIn 0.5s var(--ease-out) forwards',
        'marquee':    'marquee 40s linear infinite',
        'spin-slow':  'spin 3s linear infinite',
      },

      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },

      // ── Screens ──
      screens: {
        '3xl': '1600px',
      },

      // ── Max Widths ──
      maxWidth: {
        'site': '1400px',
      },
    },
  },
  plugins: [],
}

export default config
```

---

### A.5 — Create `vercel.json`

Create this file in the **project root** (same level as `package.json`):

```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install",
  "regions": ["lhr1"],
  "crons": [
    {
      "path": "/api/cron/abandoned-cart",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/expired-coupons",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

### A.6 — Create / Replace `src/providers/RootProvider.tsx`

If a `RootProvider.tsx` already exists, replace it entirely.
If separate providers exist (SessionProvider, etc.), do **not** delete them yet — just create/update this file:

```tsx
// src/providers/RootProvider.tsx
'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

interface RootProviderProps {
  children: React.ReactNode
}

export function RootProvider({ children }: RootProviderProps) {
  // QueryClient must be created inside state to avoid sharing between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--charcoal)',
              color: 'var(--ivory)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            },
            success: {
              iconTheme: {
                primary: 'var(--gold)',
                secondary: 'var(--charcoal)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: 'var(--ivory)',
              },
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  )
}
```

---

### A.7 — Update `src/app/layout.tsx`

Open the existing root layout. Make the following targeted changes:

**1. Update font imports** — ensure all three font families are loaded:

```tsx
import { Cormorant_Garamond, DM_Sans, Cormorant_SC } from 'next/font/google'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const cormorantSC = Cormorant_SC({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-cormorant-sc',
  display: 'swap',
})
```

**2. Apply all three font variables** to the `<html>` element:
```tsx
<html
  lang="en"
  className={`${cormorant.variable} ${dmSans.variable} ${cormorantSC.variable}`}
>
```

**3. Replace the existing provider wrapper** with `<RootProvider>`.
Import it: `import { RootProvider } from '@/providers/RootProvider'`
Wrap `{children}` with `<RootProvider>{children}</RootProvider>`.

**4. Ensure LenisProvider wraps the body content** (inside `<body>`, outside `<RootProvider>` if it's a client component, or vice versa — keep Lenis as a client-only layer around page content, not around auth/query providers).

Correct nesting order:
```tsx
<html ...>
  <body>
    <RootProvider>
      <LenisProvider>
        {children}
      </LenisProvider>
    </RootProvider>
  </body>
</html>
```

**5. Update base metadata** (merge, do not replace existing):
```tsx
export const metadata: Metadata = {
  title: {
    template: '%s | Prudential Atelier',
    default: 'Prudential Atelier — Luxury Nigerian Fashion & Bespoke Couture',
  },
  description:
    'Bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Luxury Nigerian fashion for the modern woman — bridal, evening, formal, and casual wear. Ships worldwide.',
  keywords: [
    'Nigerian fashion',
    'bespoke couture Nigeria',
    'luxury bridal Lagos',
    'Prudent Gabriel',
    'Prudential Atelier',
    'Nigerian designer',
    'African fashion',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: 'Prudential Atelier',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@prudent_gabriel',
  },
}
```

---

### A.8 — Verify `src/lib/prisma.ts`

Check the file exists and matches this exact pattern. If it differs, replace it:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

---

### A.9 — Verify `src/lib/utils.ts`

Ensure this file exists with at minimum these exports. Add any that are missing — do not overwrite existing working functions:

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nanoid } from 'nanoid'

// ── Class merging utility ──
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ── Price formatting ──
type Currency = 'NGN' | 'USD' | 'GBP'

export function formatPrice(amount: number, currency: Currency): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    NGN: new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
    USD: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }),
    GBP: new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }),
  }
  return formatters[currency].format(amount)
}

// ── Order number generator ──
// Format: PA-YYYY-XXXXX (e.g. PA-2024-00042)
export function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const id = Math.floor(10000 + Math.random() * 90000)
  return `PA-${year}-${id}`
}

// ── Bespoke request number ──
// Format: BQ-YYYY-XXXX (e.g. BQ-2024-0012)
export function generateRequestNumber(): string {
  const year = new Date().getFullYear()
  const id = Math.floor(1000 + Math.random() * 9000)
  return `BQ-${year}-${id}`
}

// ── SKU generator ──
export function generateSKU(productSlug: string, size: string): string {
  return `${productSlug}-${size.toLowerCase().replace(/\s+/g, '-')}`
}

// ── Text truncation ──
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

// ── Slugify ──
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Initials from name ──
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ── Date formatting ──
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── Delay utility (for async operations) ──
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

---

### A.10 — Verify Prisma Schema

Open `prisma/schema.prisma`. Check if the `directUrl` field is set under `datasource db`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

If `directUrl` is missing, add it. This is required for Neon.tech (Vercel's recommended PostgreSQL).

Also verify `.env.local` has both keys (as placeholders if not yet configured):
```
DATABASE_URL=""
DIRECT_URL=""
```

---

### A.11 — Create Cron Route Stubs

Create these two files so Vercel doesn't error on the cron jobs defined in `vercel.json`:

```typescript
// src/app/api/cron/abandoned-cart/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: Stage 9 — implement abandoned cart email logic
  console.log('[CRON] abandoned-cart: ran at', new Date().toISOString())
  return NextResponse.json({ ok: true, ran: new Date().toISOString() })
}
```

```typescript
// src/app/api/cron/expired-coupons/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: Stage 7 — implement coupon expiry logic
  console.log('[CRON] expired-coupons: ran at', new Date().toISOString())
  return NextResponse.json({ ok: true, ran: new Date().toISOString() })
}
```

Also add `CRON_SECRET=""` to `.env.local`.

---

### A.12 — Run Health Check

Run the dev server and confirm zero TypeScript errors and zero import errors:

```bash
npm run dev
```

If there are errors, fix them before proceeding to Task B.
Run `npx tsc --noEmit` and resolve all type errors.

---

**✅ TASK A COMPLETE — Output a summary before proceeding.**

---

## TASK B — AUDIT & PATCH STAGE 2 (AUTH SYSTEM)

The repo reportedly has `auth.ts`, a NextAuth route, and some auth scaffolding.
Audit each item and patch only what is missing or incorrect.

---

### B.1 — Verify `src/auth.ts` Structure

Open `src/auth.ts`. It must export `{ handlers, signIn, signOut, auth }` from NextAuth v5.
Verify these four items:

**1. Providers:** Both `Credentials` and `Google` must be configured.
- Credentials: validates email + password with bcrypt. Returns `null` on failure (not throw).
- Google: uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars.

**2. JWT callback** must attach these fields to the token when `user` is present:
```typescript
token.id = user.id
token.role = (user as any).role
token.referralCode = (user as any).referralCode
token.pointsBalance = (user as any).pointsBalance
```

**3. Session callback** must expose those fields to the client:
```typescript
session.user.id = token.id as string
session.user.role = token.role as string
session.user.referralCode = token.referralCode as string
session.user.pointsBalance = token.pointsBalance as number
```

**4. Pages config:**
```typescript
pages: {
  signIn: '/auth/login',
  error: '/auth/error',
}
```

If any of these are missing or wrong, fix them now.

---

### B.2 — Extend NextAuth Types

Create or update `src/types/next-auth.d.ts` to extend the session/JWT types:

```typescript
// src/types/next-auth.d.ts
import { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      referralCode: string
      pointsBalance: number
    } & DefaultSession['user']
  }

  interface User {
    role: string
    referralCode: string
    pointsBalance: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    referralCode: string
    pointsBalance: number
  }
}
```

---

### B.3 — Verify `src/middleware.ts`

The middleware must:
1. Use `auth` from `@/auth` (NextAuth v5 pattern).
2. Protect `/account/*` and `/checkout` — redirect to `/auth/login?callbackUrl=` if no session.
3. Protect `/admin/*` — check `session.user.role` is `'ADMIN'` or `'SUPER_ADMIN'`, redirect to `/account` if not.
4. Allow all other routes through.

If the current middleware uses a different pattern, replace with:

```typescript
// src/middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req

  const isLoggedIn = !!session
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const isAccountRoute = nextUrl.pathname.startsWith('/account')
  const isAdminRoute   = nextUrl.pathname.startsWith('/admin')
  const isCheckout     = nextUrl.pathname.startsWith('/checkout')

  // Redirect unauthenticated users
  if ((isAccountRoute || isCheckout) && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect non-admins trying to access admin
  if (isAdminRoute && !isAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/auth/login', nextUrl.origin)
      loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/account', nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/account/:path*',
    '/admin/:path*',
    '/checkout/:path*',
  ],
}
```

---

### B.4 — Verify Auth API Routes

Check these files exist and are correct:

**`src/app/api/auth/[...nextauth]/route.ts`:**
```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

**`src/app/api/auth/register/route.ts`** — must exist as a `POST` handler.
Check that it:
- Validates input with Zod `registerSchema`
- Checks for existing email (409 if found)
- Hashes password with `bcrypt.hash(password, 12)`
- Handles referral code: looks up referrer by `referralCode` field
- Uses `prisma.$transaction()` to create user + award points atomically
- Sends welcome email after transaction
- Returns `{ success: true }`

If this file doesn't exist, create it with all the above logic fully implemented.

**`src/app/api/auth/forgot-password/route.ts`** — must exist as a `POST` handler.
If missing, create a stub that:
- Finds user by email
- Creates a `PasswordResetToken` (token = `nanoid(32)`, expires = now + 1hr)
- TODO: sends email (wire in Stage 9)
- Returns `{ success: true }` regardless (don't reveal if email exists)

**`src/app/api/auth/reset-password/route.ts`** — create stub if missing:
- Validates token exists and is not expired
- Updates user password (bcrypt hash)
- Deletes used token
- Returns `{ success: true }`

---

### B.5 — Verify Auth Pages Exist

Check these pages exist. If any are missing, create them with the correct layout as specified in the master prompt Stage 2:

- `src/app/(auth)/layout.tsx` — clean layout, no navbar/footer
- `src/app/(auth)/auth/login/page.tsx` — 50/50 split layout
- `src/app/(auth)/auth/register/page.tsx` — same split, with referral code field
- `src/app/(auth)/auth/forgot-password/page.tsx`
- `src/app/(auth)/auth/reset-password/[token]/page.tsx`

For any that are missing: create the full implementation per the master prompt.
For any that exist: verify they use React Hook Form + Zod validation and have a loading state on the submit button.

---

### B.6 — Create `src/app/ref/[code]/page.tsx`

If this file doesn't exist, create it:

```typescript
// src/app/ref/[code]/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface Props {
  params: { code: string }
}

export default async function ReferralPage({ params }: Props) {
  const cookieStore = cookies()

  // Store referral code in cookie (30 days)
  cookieStore.set('pa_ref_code', params.code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  // Redirect to register page with code in URL
  redirect(`/auth/register?ref=${params.code}`)
}
```

---

### B.7 — Create Zod Validation Schemas

Create `src/validations/auth.ts` if it doesn't exist:

```typescript
// src/validations/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName:  z.string().min(2, 'Last name must be at least 2 characters'),
    email:     z.string().email('Please enter a valid email address'),
    phone:     z.string().min(10, 'Please enter a valid phone number'),
    password:  z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    referralCode:    z.string().optional(),
    acceptTerms:     z.boolean().refine((v) => v === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    token:           z.string().min(1),
    password:        z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type LoginInput           = z.infer<typeof loginSchema>
export type RegisterInput        = z.infer<typeof registerSchema>
export type ForgotPasswordInput  = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput   = z.infer<typeof resetPasswordSchema>
```

---

### B.8 — Run Auth Health Check

Test the following manually or by inspecting code:
1. `npm run dev` — still no errors after auth changes
2. Navigate to `/auth/login` — page loads with split layout
3. Navigate to `/account` — redirects to `/auth/login?callbackUrl=/account`
4. Navigate to `/admin` — redirects to `/auth/login?callbackUrl=/admin`
5. `npx tsc --noEmit` — no TypeScript errors

---

**✅ TASK B COMPLETE — Output a summary before proceeding.**

---

## TASK C — BEGIN STAGE 3: GLOBAL LAYOUT SHELL

Build the complete layout system shell. Some of these components may partially exist.
For each: **check if it exists → patch if partial → create if missing.**

---

### C.1 — Create `src/components/ui/` Primitives

Build these primitive components. Each must:
- Accept `className` prop (merged with `cn()`)
- Be fully typed with TypeScript
- Use CSS variables for all colors (not hardcoded hex values)

**`src/components/ui/Button.tsx`:**

```tsx
// src/components/ui/Button.tsx
'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  children:  React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-wine text-ivory hover:bg-wine-hover border border-wine hover:border-wine-hover',
  secondary: 'bg-transparent text-wine border border-wine hover:bg-wine hover:text-ivory',
  ghost:     'bg-transparent text-charcoal border border-transparent hover:text-wine hover:border-wine',
  gold:      'bg-gold text-charcoal border border-gold hover:bg-gold-hover hover:border-gold-hover',
  danger:    'bg-error text-ivory border border-error hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[11px] tracking-[0.12em]',
  md: 'px-6 py-3 text-[12px] tracking-[0.12em]',
  lg: 'px-8 py-4 text-[13px] tracking-[0.14em]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center gap-2',
          'font-label uppercase transition-all duration-200',
          'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Shimmer pseudo (via overflow + before pseudo)
          'overflow-hidden',
          'before:absolute before:inset-0 before:-translate-x-full',
          'hover:before:translate-x-full before:transition-transform before:duration-500',
          'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

**`src/components/ui/SectionLabel.tsx`:**

```tsx
// src/components/ui/SectionLabel.tsx
import { cn } from '@/lib/utils'

interface SectionLabelProps {
  children: React.ReactNode
  className?: string
  light?: boolean  // For use on dark backgrounds
}

export function SectionLabel({ children, className, light }: SectionLabelProps) {
  return (
    <div className={cn('flex items-center gap-3 justify-center', className)}>
      <div className={cn('h-px w-10 flex-shrink-0', light ? 'bg-gold/60' : 'bg-gold')} />
      <span
        className={cn(
          'font-label text-[11px] tracking-[0.2em] uppercase',
          light ? 'text-gold' : 'text-gold'
        )}
      >
        {children}
      </span>
      <div className={cn('h-px w-10 flex-shrink-0', light ? 'bg-gold/60' : 'bg-gold')} />
    </div>
  )
}
```

**`src/components/ui/Divider.tsx`:**

```tsx
// src/components/ui/Divider.tsx
import { cn } from '@/lib/utils'

interface DividerProps {
  className?: string
  ornament?: boolean  // Shows the diamond ◆ in center
}

export function Divider({ className, ornament = true }: DividerProps) {
  if (!ornament) {
    return <div className={cn('h-px w-full bg-border', className)} />
  }

  return (
    <div className={cn('relative flex items-center gap-4 my-2', className)}>
      <div className="h-px flex-1 bg-border" />
      <span className="text-gold text-xs leading-none select-none">◆</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
```

**`src/components/ui/Badge.tsx`:**

```tsx
// src/components/ui/Badge.tsx
import { cn } from '@/lib/utils'

type BadgeVariant = 'wine' | 'gold' | 'success' | 'outline-gold' | 'outline-wine' | 'grey'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  wine:          'bg-wine text-ivory',
  gold:          'bg-gold text-charcoal',
  success:       'bg-success text-ivory',
  'outline-gold': 'border border-gold text-gold bg-transparent',
  'outline-wine': 'border border-wine text-wine bg-transparent',
  grey:          'bg-charcoal/10 text-charcoal-mid',
}

export function Badge({ children, variant = 'wine', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5',
        'font-label text-[10px] tracking-[0.12em] uppercase rounded-sm',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
```

**`src/components/ui/Skeleton.tsx`:**

```tsx
// src/components/ui/Skeleton.tsx
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-gradient-to-r from-ivory-dark via-border to-ivory-dark',
        'bg-[length:200%_100%] animate-shimmer',
        className
      )}
    />
  )
}

// ProductCard-shaped skeleton
export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4] w-full rounded-sm" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
```

**`src/components/ui/Spinner.tsx`:**

```tsx
// src/components/ui/Spinner.tsx
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-gold border-t-transparent',
        sizeClasses[size],
        className
      )}
    />
  )
}
```

---

### C.2 — Create `src/components/layout/AnnouncementBar.tsx`

```tsx
// src/components/layout/AnnouncementBar.tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MESSAGES = [
  'Free shipping on orders over ₦150,000 within Lagos',
  'New collection now available — Shop The Edit',
  'Book a bespoke consultation today',
]

const DISMISSED_KEY = 'pa_announcement_dismissed'

export function AnnouncementBar() {
  const [visible, setVisible] = useState(false)
  const [index,   setIndex]   = useState(0)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) setVisible(true)

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  if (!visible) return null

  return (
    <div className="relative bg-wine px-4 py-2 text-center">
      <p className="font-label text-[11px] tracking-[0.15em] uppercase text-gold/90 pr-6">
        {MESSAGES[index]}
      </p>
      <button
        onClick={() => {
          setVisible(false)
          localStorage.setItem(DISMISSED_KEY, '1')
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/60 hover:text-gold transition-colors"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  )
}
```

---

### C.3 — Create `src/components/layout/Navbar.tsx`

Build the full Navbar as specified. This is the most complex component in Stage 3:

```tsx
// src/components/layout/Navbar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Search, Heart, User, ShoppingBag, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CurrencySwitcher } from '@/components/common/CurrencySwitcher'
import { useCartStore } from '@/store/cartStore'
import { MobileMenu } from './MobileMenu'

const NAV_LINKS = [
  { label: 'Shop',       href: '/shop' },
  { label: 'Bespoke',    href: '/bespoke' },
  { label: 'Our Story',  href: '/our-story' },
  { label: 'Press',      href: '/press' },
]

export function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const { data: session }             = useSession()
  const { totalItems, openCart }      = useCartStore()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          scrolled
            ? 'bg-cream/95 backdrop-blur-sm border-b border-border shadow-sm'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto max-w-site px-6 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Desktop: Left nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'font-label text-[11px] tracking-[0.15em] uppercase transition-colors duration-200',
                    'relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-gold',
                    'after:transition-all after:duration-300 hover:after:w-full',
                    scrolled ? 'text-charcoal hover:text-wine' : 'text-ivory/90 hover:text-ivory'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile: Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className={cn(
                'lg:hidden p-2 transition-colors',
                scrolled ? 'text-charcoal' : 'text-ivory'
              )}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            {/* Center: Logo */}
            <Link
              href="/"
              className={cn(
                'font-display text-xl lg:text-2xl font-medium tracking-[0.1em] uppercase',
                'absolute left-1/2 -translate-x-1/2 transition-colors duration-300',
                scrolled ? 'text-wine' : 'text-ivory'
              )}
            >
              Prudential Atelier
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 lg:gap-3">
              {/* Currency (desktop only) */}
              <div className="hidden lg:block">
                <CurrencySwitcher />
              </div>

              {/* Search */}
              <button
                className={cn(
                  'p-2 transition-colors rounded-sm hover:bg-wine-muted',
                  scrolled ? 'text-charcoal hover:text-wine' : 'text-ivory/90 hover:text-ivory'
                )}
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              {/* Wishlist */}
              <Link
                href="/account/wishlist"
                className={cn(
                  'p-2 transition-colors rounded-sm hover:bg-wine-muted',
                  scrolled ? 'text-charcoal hover:text-wine' : 'text-ivory/90 hover:text-ivory'
                )}
                aria-label="Wishlist"
              >
                <Heart size={18} />
              </Link>

              {/* Account */}
              <Link
                href={session ? '/account' : '/auth/login'}
                className={cn(
                  'p-2 transition-colors rounded-sm hover:bg-wine-muted',
                  scrolled ? 'text-charcoal hover:text-wine' : 'text-ivory/90 hover:text-ivory'
                )}
                aria-label="Account"
              >
                <User size={18} />
              </Link>

              {/* Cart */}
              <button
                onClick={openCart}
                className={cn(
                  'relative p-2 transition-colors rounded-sm hover:bg-wine-muted',
                  scrolled ? 'text-charcoal hover:text-wine' : 'text-ivory/90 hover:text-ivory'
                )}
                aria-label={`Cart (${totalItems} items)`}
              >
                <ShoppingBag size={18} />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gold text-charcoal text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PFA accent link — subtle, desktop only */}
        <div className={cn(
          'hidden lg:flex justify-end px-10 pb-1 transition-opacity duration-300',
          scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <a
            href="https://pfacademy.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] tracking-[0.15em] uppercase text-gold hover:text-gold-hover transition-colors"
          >
            Fashion Academy ↗
          </a>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
```

---

### C.4 — Create `src/components/layout/MobileMenu.tsx`

```tsx
// src/components/layout/MobileMenu.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, Instagram, Facebook } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CurrencySwitcher } from '@/components/common/CurrencySwitcher'

const NAV_LINKS = [
  { label: 'Shop',       href: '/shop' },
  { label: 'Bespoke',    href: '/bespoke' },
  { label: 'Our Story',  href: '/our-story' },
  { label: 'Press',      href: '/press' },
]

interface MobileMenuProps {
  isOpen:  boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { data: session } = useSession()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 bg-charcoal flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-charcoal-mid">
            <span className="font-display text-ivory text-lg tracking-[0.1em] uppercase">
              Prudential Atelier
            </span>
            <button onClick={onClose} className="p-2 text-ivory/60 hover:text-ivory">
              <X size={22} />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 flex flex-col justify-center px-8 gap-1">
            {NAV_LINKS.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.1, duration: 0.35 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-4 font-display text-3xl text-ivory/80 hover:text-ivory hover:pl-2 transition-all duration-200"
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}

            <div className="h-px bg-charcoal-mid my-4" />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col gap-3"
            >
              <Link href={session ? '/account' : '/auth/login'} onClick={onClose}
                className="font-label text-[12px] tracking-[0.15em] uppercase text-ivory/60 hover:text-gold transition-colors">
                {session ? 'My Account' : 'Sign In / Register'}
              </Link>
              <Link href="/account/wishlist" onClick={onClose}
                className="font-label text-[12px] tracking-[0.15em] uppercase text-ivory/60 hover:text-gold transition-colors">
                Wishlist
              </Link>
              <a href="https://pfacademy.ng" target="_blank" rel="noopener noreferrer"
                className="font-label text-[12px] tracking-[0.15em] uppercase text-gold hover:text-gold-hover transition-colors">
                Fashion Academy ↗
              </a>
            </motion.div>

            <div className="mt-8">
              <CurrencySwitcher />
            </div>
          </nav>

          {/* Social Footer */}
          <div className="px-8 py-6 border-t border-charcoal-mid flex items-center gap-4">
            <a href="https://instagram.com/prudent_gabriel" target="_blank" rel="noopener noreferrer"
              className="text-ivory/40 hover:text-gold transition-colors">
              <Instagram size={18} />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
              className="text-ivory/40 hover:text-gold transition-colors">
              <Facebook size={18} />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

### C.5 — Create `src/components/common/CurrencySwitcher.tsx`

Check if it exists. If it does, verify it reads from and writes to `currencyStore`. If not, create:

```tsx
// src/components/common/CurrencySwitcher.tsx
'use client'

import { cn } from '@/lib/utils'
import { useCurrencyStore } from '@/store/currencyStore'

const CURRENCIES = [
  { code: 'NGN', symbol: '₦' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
] as const

export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrencyStore()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code)}
          className={cn(
            'px-2.5 py-1 rounded-sm font-label text-[10px] tracking-[0.1em] uppercase transition-all duration-150',
            currency === c.code
              ? 'bg-wine text-ivory'
              : 'text-charcoal-mid hover:text-wine'
          )}
          aria-pressed={currency === c.code}
          aria-label={`Switch to ${c.code}`}
        >
          {c.symbol} {c.code}
        </button>
      ))}
    </div>
  )
}
```

---

### C.6 — Verify / Create `src/store/cartStore.ts`

Verify the Zustand cart store exists and exports at minimum:
- `totalItems: number`
- `isOpen: boolean`
- `openCart(): void`
- `closeCart(): void`
- `items: CartItem[]`
- `addItem(item): void`
- `removeItem(id): void`
- `updateQty(id, qty): void`
- `clearCart(): void`

If missing or incomplete, create it:

```typescript
// src/store/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id:          string  // variantId + colorId combination key
  productId:   string
  productName: string
  productSlug: string
  variantId:   string
  size:        string
  color?:      string
  colorHex?:   string
  imageUrl:    string
  priceNGN:    number
  priceUSD:    number
  priceGBP:    number
  quantity:    number
}

interface CartStore {
  items:      CartItem[]
  isOpen:     boolean
  totalItems: number
  totalNGN:   number

  openCart:    () => void
  closeCart:   () => void
  addItem:     (item: CartItem) => void
  removeItem:  (id: string) => void
  updateQty:   (id: string, qty: number) => void
  clearCart:   () => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items:      [],
      isOpen:     false,
      totalItems: 0,
      totalNGN:   0,

      openCart:  () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (item) => {
        const { items } = get()
        const existing = items.find((i) => i.id === item.id)
        let newItems: CartItem[]

        if (existing) {
          newItems = items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
          )
        } else {
          newItems = [...items, item]
        }

        set({
          items:      newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN:   newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
          isOpen:     true,
        })
      },

      removeItem: (id) => {
        const newItems = get().items.filter((i) => i.id !== id)
        set({
          items:      newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN:   newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
        })
      },

      updateQty: (id, qty) => {
        if (qty < 1) { get().removeItem(id); return }
        const newItems = get().items.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
        set({
          items:      newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN:   newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
        })
      },

      clearCart: () => set({ items: [], totalItems: 0, totalNGN: 0 }),
    }),
    {
      name: 'pa-cart',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0)
          state.totalNGN   = state.items.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0)
        }
      },
    }
  )
)
```

---

### C.7 — Verify / Create `src/store/currencyStore.ts`

```typescript
// src/store/currencyStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Currency = 'NGN' | 'USD' | 'GBP'

interface ExchangeRates {
  NGN: number
  USD: number
  GBP: number
  fetchedAt: number
}

interface CurrencyStore {
  currency:    Currency
  rates:       ExchangeRates
  setCurrency: (c: Currency) => void
  setRates:    (r: ExchangeRates) => void
}

const DEFAULT_RATES: ExchangeRates = {
  NGN: 1600,  // Approximate fallback — real rates fetched on mount
  USD: 1,
  GBP: 0.79,
  fetchedAt: 0,
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currency:    'NGN',
      rates:       DEFAULT_RATES,
      setCurrency: (currency) => set({ currency }),
      setRates:    (rates)    => set({ rates }),
    }),
    {
      name: 'pa-currency',
    }
  )
)
```

---

### C.8 — Create `src/app/(storefront)/layout.tsx`

Create the storefront route group layout. This wraps all public-facing pages:

```tsx
// src/app/(storefront)/layout.tsx
import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Navbar }          from '@/components/layout/Navbar'
import { Footer }          from '@/components/layout/Footer'

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
```

---

### C.9 — Create `src/components/layout/Footer.tsx` (Stub)

Create a functional stub footer that can be filled out fully in Stage 8.
It must render correctly and not throw errors:

```tsx
// src/components/layout/Footer.tsx
import Link from 'next/link'
import { Instagram, Facebook } from 'lucide-react'

const SHOP_LINKS   = [
  { label: 'New Arrivals', href: '/shop?filter=newArrival' },
  { label: 'RTW Collection', href: '/shop?type=RTW' },
  { label: 'Bespoke Couture', href: '/bespoke' },
  { label: 'Bridal', href: '/shop?category=BRIDAL' },
]
const COMPANY_LINKS = [
  { label: 'Our Story', href: '/our-story' },
  { label: 'Press', href: '/press' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'PFA Academy ↗', href: 'https://pfacademy.ng', external: true },
]

export function Footer() {
  return (
    <footer className="bg-charcoal text-ivory/70">
      {/* Gold accent line */}
      <div className="h-px bg-gold/30 w-full" />

      <div className="mx-auto max-w-site px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16">

          {/* Col 1: Brand */}
          <div className="lg:col-span-1">
            <p className="font-display text-ivory text-xl tracking-[0.1em] uppercase mb-4">
              Prudential Atelier
            </p>
            <p className="font-body text-sm leading-relaxed text-ivory/60 mb-6">
              Luxury Nigerian fashion for the woman who commands every room.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://instagram.com/prudent_gabriel" target="_blank" rel="noopener noreferrer"
                className="text-ivory/40 hover:text-gold transition-colors">
                <Instagram size={18} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                className="text-ivory/40 hover:text-gold transition-colors">
                <Facebook size={18} />
              </a>
            </div>
          </div>

          {/* Col 2: Shop */}
          <div>
            <p className="font-label text-[11px] tracking-[0.18em] uppercase text-gold mb-4">Shop</p>
            <ul className="space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="font-body text-sm text-ivory/60 hover:text-ivory transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Company */}
          <div>
            <p className="font-label text-[11px] tracking-[0.18em] uppercase text-gold mb-4">Company</p>
            <ul className="space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer"
                      className="font-body text-sm text-ivory/60 hover:text-gold transition-colors">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href}
                      className="font-body text-sm text-ivory/60 hover:text-ivory transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Newsletter stub */}
          <div>
            <p className="font-label text-[11px] tracking-[0.18em] uppercase text-gold mb-4">
              Inner Circle
            </p>
            <p className="font-display text-ivory text-lg italic mb-4">
              "Join the Atelier Community"
            </p>
            <p className="font-body text-xs text-ivory/50 mb-4">
              Early access to collections, exclusive offers, and stories from the atelier.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 bg-charcoal-mid border border-charcoal-mid focus:border-gold
                           rounded-sm px-3 py-2 text-sm font-body text-ivory placeholder:text-ivory/30
                           outline-none transition-colors"
              />
              <button className="bg-gold text-charcoal px-4 py-2 font-label text-[11px] tracking-[0.1em] uppercase rounded-sm hover:bg-gold-hover transition-colors">
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-charcoal-mid flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-ivory/40">
            © {new Date().getFullYear()} Prudential Atelier · All Rights Reserved
          </p>
          <div className="flex items-center gap-6">
            {[['Privacy Policy', '/legal/privacy'], ['Terms', '/legal/terms'], ['Returns', '/legal/returns']].map(([label, href]) => (
              <Link key={href} href={href}
                className="font-body text-xs text-ivory/40 hover:text-ivory/70 transition-colors">
                {label}
              </Link>
            ))}
          </div>
          <p className="font-body text-xs text-ivory/30">Made with ♡ in Lagos</p>
        </div>
      </div>
    </footer>
  )
}
```

---

### C.10 — Move Existing Homepage

If `src/app/page.tsx` currently contains homepage content, move it to:
`src/app/(storefront)/page.tsx`

If `src/app/(storefront)/page.tsx` doesn't exist yet, create a placeholder:

```tsx
// src/app/(storefront)/page.tsx
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory">
      <div className="text-center">
        <p className="font-label text-[11px] tracking-[0.2em] uppercase text-gold mb-4">
          ——  COMING SOON  ——
        </p>
        <h1 className="font-display text-5xl text-charcoal italic">
          Prudential Atelier
        </h1>
        <p className="font-body text-charcoal-light mt-4">
          Homepage — Stage 8
        </p>
      </div>
    </div>
  )
}
```

---

### C.11 — Final Health Check for Task C

```bash
npm run dev
```

Verify:
1. App loads without errors at `localhost:3000`
2. AnnouncementBar visible at top (wine background, gold text)
3. Navbar renders — transparent on homepage, scrolls to ivory/cream
4. Footer renders at bottom
5. Currency switcher is functional
6. Mobile menu opens and closes on small screens
7. No TypeScript errors: `npx tsc --noEmit`

---

**✅ TASK C COMPLETE — Output a full summary of every file created or modified.**

---

## END OF SESSION

After completing all three tasks, output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Stage 1 gaps closed
✅ Task B — Stage 2 audit complete
✅ Task C — Stage 3 shell built

NEXT SESSION: Continue Stage 3 with:
  - CartDrawer.tsx
  - SearchModal.tsx
  - src/components/common/ProductCard.tsx
  - src/store/recentlyViewedStore.ts
  - src/app/api/currency/rates/route.ts
  Then move to Stage 4 (Shop + Product pages)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
