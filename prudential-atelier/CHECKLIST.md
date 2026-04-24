# Pre-Launch Checklist

## Code

- [ ] npx tsc --noEmit passes
- [ ] npx next build succeeds locally
- [ ] No console.log debug statements in production code
- [ ] All environment variables documented in .env.example

## Database

- [ ] DATABASE_URL (pooled) set in Vercel
- [ ] DIRECT_URL (unpooled) set in Vercel
- [ ] After deploy: npx prisma migrate deploy OR npx prisma db push
- [ ] After deploy: npx prisma db seed

## Auth

- [ ] NEXTAUTH_SECRET set (strong random value)
- [ ] NEXTAUTH_URL set to production domain
- [ ] NEXT_PUBLIC_APP_URL set to production domain
- [ ] Google OAuth: callback URL updated in Google Cloud Console (if using)

## Payments (test mode first)

- [ ] Paystack: test keys set, test payment completes
- [ ] Webhook URLs registered in payment dashboards
- [ ] STRIPE_WEBHOOK_SECRET matches registered webhook

## Email

- [ ] RESEND_API_KEY set OR emails logging to console is acceptable for demo
- [ ] ADMIN_EMAIL set to receiving email address

## Demo readiness

- [ ] Seed data loads: 14 products visible in /shop
- [ ] Admin login works: admin@prudentgabriel.com / Admin@PA2024!
- [ ] Customer login works: amara@example.com / Customer@2024
- [ ] Homepage loads without errors
- [ ] Product detail page shows variants + price switching
- [ ] Coupon WELCOME10 applies 10% discount at checkout
- [ ] /admin shows analytics with seeded data
- [ ] /admin/products shows 14 products
- [ ] /admin/bespoke shows 8 requests
- [ ] /admin/reviews shows 1 pending review

## Performance

- [ ] Lighthouse score > 80 on homepage (run after deploy)
- [ ] Core Web Vitals green in Vercel Analytics
