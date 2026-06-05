import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'STAFF_ADMIN',
  'BESPOKE_MANAGER',
  'RTW_MANAGER',
  'CONTENT_MANAGER',
  'FINANCE_MANAGER',
  'HR_MANAGER',
  'CONSULTATION_MANAGER',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ─── STEP 1: PUBLIC PATHS — return immediately, no checks ───
  // Use exact match for login pages to avoid 
  // /admin-login matching /admin guard
  
  if (
    pathname === '/' ||
    pathname === '/admin-login' ||
    pathname === '/staff-login' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/about' ||
    pathname === '/contact' ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/track') ||
    pathname.startsWith('/quote') ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/consultation') ||
    pathname.startsWith('/journal') ||
    pathname.startsWith('/bespoke') ||
    pathname.startsWith('/bridal') ||
    pathname.startsWith('/kids') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/payment') ||
    pathname.startsWith('/attendance/qr') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/payments') ||
    pathname.startsWith('/api/products') ||
    pathname.startsWith('/api/blog') ||
    pathname.startsWith('/api/consultations') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons') ||
    pathname.includes('favicon') ||
    pathname.includes('.')  // static files
  ) {
    return NextResponse.next()
  }

  // ─── STEP 2: GET JWT TOKEN ───────────────────────────────────
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  })

  // ─── STEP 3: PROTECTED ACCOUNT ROUTES (/account/*) ──────────
  if (pathname.startsWith('/account')) {
    if (!token) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, 
        request.url)
      )
    }
    // Force password reset
    if (token.mustResetPassword && 
        !pathname.startsWith('/reset-password')) {
      return NextResponse.redirect(
        new URL('/reset-password?required=true', request.url)
      )
    }
    return NextResponse.next()
  }

  // ─── STEP 4: STAFF PORTAL ROUTES (/staff/*) ─────────────────
  if (pathname.startsWith('/staff')) {
    if (!token) {
      return NextResponse.redirect(
        new URL('/staff-login', request.url)
      )
    }
    // Force password reset
    if (token.mustResetPassword) {
      return NextResponse.redirect(
        new URL('/reset-password?required=true', request.url)
      )
    }
    return NextResponse.next()
  }

  // ─── STEP 5: ADMIN ROUTES (/admin/*) ────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(
        new URL('/admin-login', request.url)
      )
    }

    console.log('ADMIN GATE - token role:', token?.role,
      'isStaff:', token?.isStaff)

    const role = token?.role as string ?? ''

    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(
        new URL('/admin-login', request.url)
      )
    }

    // Developer section — Super Admin only
    if (pathname.startsWith('/admin/settings/developer') && 
        role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(
        new URL('/admin', request.url)
      )
    }

    // Users & Roles settings — Super Admin and Admin only
    if (pathname.startsWith('/admin/settings/users') && 
        role !== 'SUPER_ADMIN' && 
        role !== 'ADMIN') {
      return NextResponse.redirect(
        new URL('/admin', request.url)
      )
    }

    if (pathname.startsWith('/admin/settings/roles') && 
        role !== 'SUPER_ADMIN' && 
        role !== 'ADMIN') {
      return NextResponse.redirect(
        new URL('/admin', request.url)
      )
    }

    // Force password reset
    if (token.mustResetPassword) {
      return NextResponse.redirect(
        new URL('/reset-password?required=true', request.url)
      )
    }

    return NextResponse.next()
  }

  // ─── STEP 6: ALL OTHER ROUTES — allow through ────────────────
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
