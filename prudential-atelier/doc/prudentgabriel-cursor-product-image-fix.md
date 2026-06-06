# CURSOR AI — PRUDENTGABRIEL.COM
## Fix: Product Image Upload/Delete + WooCommerce Image Migration
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## ISSUE 1 — RTW PRODUCT IMAGE UPLOAD AND DELETE NOT WORKING

In `/admin/shop/products` and the product edit/create page:

### Fix the upload:

1. Find the product image upload component (likely `ProductImageUpload.tsx` or similar)
2. Check the Cloudinary upload widget is initializing correctly
3. Check the API route that saves the image URL:
   - `PATCH /api/admin/products/[id]/images`
   - or `POST /api/admin/products/[id]/images`
4. Console.log the response to see what's failing
5. Ensure the image is saved to the `ProductImage` model with the correct `productId`

### Fix the delete:

1. The delete button on each image should call:
   `DELETE /api/admin/products/[id]/images/[imageId]`
2. Check the route exists and is working
3. After delete: remove image from UI state immediately (optimistic update — don't wait for page refresh)
4. Also delete from Cloudinary using the Cloudinary destroy API

### Image ordering:

- The first image should be marked `isPrimary: true`
- If the primary image is deleted, promote the next image to primary automatically

---

## ISSUE 2 — BROKEN IMAGES FROM WOOCOMMERCE CSV IMPORT

Products imported from WooCommerce have image URLs pointing to:
`prudentgabriel.com/wp-content/uploads/...`

These images are on the old WordPress server and may be broken or inaccessible.

Fix this in three ways:

---

### Fix A — Show proper placeholder for broken images

In `ProductCard.tsx` and the product detail page, add an `onError` handler to all product images:

```tsx
const [imgSrc, setImgSrc] = useState(image.url)

<Image
  src={imgSrc}
  onError={() => setImgSrc('/images/pg-placeholder.jpg')}
  alt={product.name}
  fill
  className="object-cover"
/>
```

Create a simple placeholder at `public/images/pg-placeholder.jpg`:
- Dark chocolate background `#442913`
- Centered "PG" monogram text
- Or use the `ImagePlaceholder` component already built in Phase 4.6

---

### Fix B — "Re-upload to Cloudinary" button per image in admin

In the product edit page, for each image where the URL contains `wp-content/uploads`, show:

```
[Image thumbnail or broken icon]
⚠ Hosted on old server
[Re-upload to Cloudinary →]
```

On click:
1. Fetch the image from the WooCommerce URL
2. Upload to Cloudinary via a new API route
3. Update `ProductImage.url` to the new Cloudinary URL
4. Show success toast: "Image migrated to Cloudinary"

**API route:** `POST /api/admin/products/[id]/images/reupload`

```typescript
// Body: { sourceUrl: string, imageId: string }

const { sourceUrl, imageId } = await req.json()

// Upload to Cloudinary from URL
const result = await cloudinary.uploader.upload(sourceUrl, {
  folder: 'prudentgabriel/products',
  fetch_format: 'auto',
  quality: 'auto',
})

// Update database
await prisma.productImage.update({
  where: { id: imageId },
  data: { url: result.secure_url }
})

return NextResponse.json({ url: result.secure_url })
```

---

### Fix C — Bulk migration option in admin products list

In `/admin/shop/products`, check if any `ProductImage` records have URLs containing `wp-content/uploads`.

If yes, show a banner at the top of the page:

```
⚠  X products have images hosted on the old WordPress server.
   These images may be broken for visitors.
   [Migrate all images to Cloudinary →]
```

**API route:** `POST /api/admin/products/migrate-images`

Logic:
1. Find all `ProductImage` records where `url` contains `wp-content/uploads`
2. For each image: upload from the WooCommerce URL to Cloudinary
3. Update `ProductImage.url` to the new Cloudinary URL
4. Return progress: `{ total, migrated, failed }`

Show a progress indicator while migration runs:
```
Migrating images... 12 / 47 complete
```

On completion:
```
✓ 45 images migrated successfully
⚠ 2 images failed (original URLs unreachable)
```

---

## EXECUTION ORDER

1. Fix product image upload in admin (check Cloudinary widget + API route)
2. Fix product image delete (check DELETE route + optimistic UI update)
3. Fix image ordering (isPrimary logic)
4. Add `onError` fallback to `ProductCard.tsx` and product detail page
5. Create `public/images/pg-placeholder.jpg` placeholder
6. Add per-image "Re-upload to Cloudinary" button in product edit page
7. Build `POST /api/admin/products/[id]/images/reupload` route
8. Add bulk migration banner to products list
9. Build `POST /api/admin/products/migrate-images` route
10. `pnpm exec tsc --noEmit` — must pass with zero errors
11. Commit and push

---

## COMPLETION CHECKLIST

- [ ] Product image upload works in admin product editor
- [ ] Product image delete works and updates UI immediately
- [ ] Primary image promoted correctly when first image deleted
- [ ] Broken WooCommerce images show PG placeholder on public site
- [ ] Per-image "Re-upload to Cloudinary" button works
- [ ] Bulk migration banner shows when WooCommerce images exist
- [ ] Bulk migration route migrates images to Cloudinary
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Product Image Fix*
