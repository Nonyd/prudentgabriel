# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Maintenance Mode Toggle
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Maintenance mode must NEVER block `/admin-login`, `/staff-login`, `/api/auth/*`.
3. If the maintenance status check fails for any reason — fail OPEN (show the site).
4. Logged-in admin users always see the full site regardless of maintenance mode.
5. Run `pnpm exec tsc --noEmit` after all changes.

---

## SECTION 1 — ADMIN SETTINGS TOGGLE

In `/admin/settings/general`, add a **"Maintenance Mode"** section at the very top of the page:

```
MAINTENANCE MODE
──────────────────────────────────────────────────

[toggle: OFF]  Maintenance Mode

"When enabled, only logged-in admin users can view 
 the website. All other visitors see a maintenance 
 page instead."

Current status: ● LIVE

Custom message (optional):
[textarea]
Placeholder: "We're making some improvements. 
              Check back soon."

[SAVE]
```

When maintenance is ON, show the status differently:
```
Current status: ⚠ MAINTENANCE MODE ACTIVE
```
In amber/gold colour (`#C9A84C`).

Saves to SiteSetting keys:
- `maintenance_mode_enabled` → `'true'` or `'false'`
- `maintenance_mode_message` → custom message text

---

## SECTION 2 — MAINTENANCE STATUS API ROUTE

Create `src/app/api/maintenance-status/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Cache for 30 seconds — fast but not stale
export const revalidate = 30

export async function GET() {
  try {
    const [enabledSetting, messageSetting] = await Promise.all([
      prisma.siteSetting.findUnique({
        where: { key: 'maintenance_mode_enabled' }
      }),
      prisma.siteSetting.findUnique({
        where: { key: 'maintenance_mode_message' }
      }),
    ])

    return NextResponse.json(
      {
        enabled: enabledSetting?.value === 'true',
        message: messageSetting?.value || 
          "We're making some improvements. Check back soon.",
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch {
    // Always fail open — never block the site on DB error
    return NextResponse.json({ enabled: false, message: '' })
  }
}
```

This route must be in the public paths list in middleware 
so it's never blocked by maintenance mode itself.

---

## SECTION 3 — MIDDLEWARE UPDATE

In `middleware.ts`, add the maintenance mode check.

Add `/api/maintenance-status` to the public paths 
that always pass through:

```typescript
pathname === '/api/maintenance-status'
```

Then add the maintenance mode check block AFTER 
the public paths early return, but BEFORE the 
account/staff/admin route guards:

```typescript
// ─── MAINTENANCE MODE CHECK ────────────────────────────
// Skip for: admin routes, login pages, api/auth, maintenance page itself
const skipMaintenance =
  pathname.startsWith('/admin') ||
  pathname.startsWith('/api/auth') ||
  pathname.startsWith('/api/maintenance-status') ||
  pathname === '/admin-login' ||
  pathname === '/staff-login' ||
  pathname === '/login' ||
  pathname === '/register' ||
  pathname === '/maintenance'

if (!skipMaintenance) {
  try {
    const maintenanceRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/maintenance-status`,
      { cache: 'no-store' }
    )
    
    if (maintenanceRes.ok) {
      const { enabled } = await maintenanceRes.json()

      if (enabled) {
        // Check if user is a logged-in admin
        const session = request.auth
        const role = session?.user?.role as string | undefined
        const isAdmin = role && [
          'SUPER_ADMIN',
          'ADMIN',
          'STAFF_ADMIN',
          'BESPOKE_MANAGER',
          'RTW_MANAGER',
          'CONTENT_MANAGER',
          'FINANCE_MANAGER',
          'HR_MANAGER',
          'CONSULTATION_MANAGER',
        ].includes(role)

        if (!isAdmin) {
          return NextResponse.rewrite(
            new URL('/maintenance', request.url)
          )
        }
      }
    }
  } catch {
    // Fail open — never block on error
  }
}
// ────────────────────────────────────────────────────────
```

---

## SECTION 4 — MAINTENANCE PAGE

Create `src/app/maintenance/page.tsx`:

This page has NO navbar and NO footer.
Full viewport height, dark chocolate background.

```
[PRUDENTIAL]                      Cormorant 24px, cream
[/ ATELIER]                       Jost 9px, var(--lightbr)

────── gold divider line ──────

"We'll be back shortly."          Cormorant 52px, cream
                                  font-weight 300

[custom message from API]         Lora 16px, var(--sand)
                                  max-width 480px, centered

─────────────────────────────────

"Follow us for updates:"          Jost 11px, var(--text-light)

[Instagram icon] @prudentgabriel  links to Instagram

─────────────────────────────────

"Already have an account?"        Jost 11px, var(--text-light)
[Log in →]                        links to /login
                                  var(--lightbr), hover cream
```

**Full layout:**
- Background: `#442913`
- Everything centered vertically and horizontally
- Viewport height: 100vh
- No scroll needed

**Fetch the custom message:**

```typescript
// Server component — fetch maintenance message
async function getMaintenanceMessage(): Promise<string> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/maintenance-status`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    return data.message || "We're making some improvements. Check back soon."
  } catch {
    return "We're making some improvements. Check back soon."
  }
}
```

**Page component:**

```tsx
export default async function MaintenancePage() {
  const message = await getMaintenanceMessage()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#442913',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      {/* Logo */}
      <div>
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, ... }}>
          PRUDENTIAL
        </p>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, ... }}>
          / ATELIER
        </p>
      </div>

      {/* Gold divider */}
      <div style={{ width: 40, height: 1, background: '#C9A84C', margin: '16px auto' }} />

      {/* Heading */}
      <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, ... }}>
        We'll be back shortly.
      </h1>

      {/* Custom message */}
      <p style={{ fontFamily: 'Lora, serif', fontSize: 16, ... }}>
        {message}
      </p>

      {/* Instagram */}
      <div>
        <p>Follow us for updates:</p>
        <a href="https://instagram.com/prudentgabriel">
          @prudentgabriel
        </a>
      </div>

      {/* Login link */}
      <div>
        <p>Already have an account?</p>
        <a href="/login">Log in →</a>
      </div>
    </div>
  )
}
```

---

## SECTION 5 — ADMIN-WIDE MAINTENANCE BANNER

In `AdminShell.tsx` or `AdminLayout`, check if 
maintenance mode is active and show a sticky banner:

```typescript
// Fetch in the server layout:
const maintenanceEnabled = await prisma.siteSetting.findUnique({
  where: { key: 'maintenance_mode_enabled' }
})
const isMaintenanceOn = maintenanceEnabled?.value === 'true'
```

If `isMaintenanceOn` is true, render a banner at the 
very top of every admin page (above the topbar):

```
⚠  MAINTENANCE MODE IS ACTIVE — The public website 
   is currently hidden from visitors.  [Turn off →]
```

**Banner design:**
- Background: `#C9A84C` (gold/amber)
- Color: `#1A0F08` (near-black)
- Jost 12px, weight 500
- Height: 36px, padding: 0 24px
- Full width, sticky at top (z-index above everything)
- "[Turn off →]" is a link to `/admin/settings/general`
- `text-decoration: underline` on hover

---

## SECTION 6 — TOGGLE WIRING IN ADMIN SETTINGS

When admin saves the General Settings with 
maintenance mode toggled:

```typescript
// PATCH /api/admin/settings/general
// Existing route — extend it to handle maintenance_mode_enabled

// After saving:
// Invalidate the maintenance-status cache by calling:
// revalidatePath('/api/maintenance-status')
// OR just rely on the 30-second cache expiry
```

Show a toast on save:
- If turning ON: 
  "⚠ Maintenance mode activated. The public site 
   is now hidden from visitors."
  Toast colour: amber

- If turning OFF:
  "✓ Maintenance mode deactivated. 
   The public site is now live."
  Toast colour: green

---

## IMPORTANT RULES — ENFORCE ALL OF THESE

1. `/admin-login` — ALWAYS accessible, NEVER blocked
2. `/staff-login` — ALWAYS accessible, NEVER blocked
3. `/api/auth/*` — ALWAYS accessible, NEVER blocked
4. `/maintenance` page itself — NEVER blocked
5. `/api/maintenance-status` — NEVER blocked
6. `/admin/*` — accessible to logged-in admins always
7. If maintenance status fetch fails → show the site (fail open)
8. Maintenance mode affects public routes ONLY:
   `/`, `/shop`, `/rtw`, `/bridal`, `/kids`, `/atelier`,
   `/journal`, `/about`, `/contact`, `/consultation`,
   `/track`, `/size-guide`, `/careers` etc.

---

## EXECUTION ORDER

1. Add `maintenance_mode_enabled` and `maintenance_mode_message` to SiteSetting (upsert defaults)
2. Build `GET /api/maintenance-status` route
3. Add maintenance check to `middleware.ts`
4. Build `/maintenance` page
5. Add maintenance mode section to `/admin/settings/general`
6. Add admin-wide maintenance banner to AdminShell/AdminLayout
7. Wire toggle save with toast feedback
8. `pnpm exec tsc --noEmit` — must pass
9. Commit and push

---

## COMPLETION CHECKLIST

- [ ] `/admin/settings/general` has maintenance mode toggle
- [ ] Toggle saves to SiteSetting correctly
- [ ] `/api/maintenance-status` returns correct status
- [ ] Middleware blocks public routes when maintenance ON
- [ ] `/admin-login` always accessible (test in incognito)
- [ ] `/staff-login` always accessible
- [ ] `/api/auth/*` always accessible
- [ ] Logged-in admin sees full site even in maintenance mode
- [ ] Logged-out visitor sees `/maintenance` page
- [ ] Maintenance page shows custom message from CMS
- [ ] Admin-wide amber banner shows when maintenance is ON
- [ ] Banner disappears when maintenance is turned OFF
- [ ] Toast shows when toggling ON and OFF
- [ ] If DB unavailable — site still shows (fail open)
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Maintenance Mode*
