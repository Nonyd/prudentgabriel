# CURSOR SESSION PROMPT — SESSION 14
## WooCommerce CSV Product Import System
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.**
> 3. **This session adds NO new DB models** — uses existing Product, ProductImage,
>    ProductVariant models. Imported products are created as DRAFTS.
> 4. **Image downloading is async and can take time** — always show progress.
> 5. **Never block the UI** during image processing — use background jobs pattern.
> 6. After every task: `npx tsc --noEmit` must pass.

---

## HOW WOOCOMMERCE CSV EXPORT WORKS

When admin exports from WooCommerce (Products → Export → CSV), the file contains:

```
Key columns we care about:
  "Name"        → product name
  "Images"      → comma-separated image URLs
                  e.g. "https://store.com/wp-content/uploads/img1.jpg,https://..."
  "Categories"  → WooCommerce categories (we IGNORE these — admin assigns manually)
  "Description" → product description (optional — we import if present)
  "Short description" → short description (optional)
  "SKU"         → original SKU (we store for reference, generate our own)
  "Stock"       → stock quantity (optional)
  "Regular price" → we IGNORE this (admin sets prices manually)
  "Sale price"  → IGNORE
  "Published"   → IGNORE (all imports become DRAFT)

The CSV may have 50+ columns — we only extract the ones above.
All other columns are silently ignored.
```

---

## TASK A — IMPORT API ROUTES

### A1 — CSV Parse + Preview API

**Create `src/app/api/admin/import/preview/route.ts`** (POST):

```typescript
// Accepts multipart form data with a CSV file
// Does NOT import anything — just parses and returns preview data
// Fast — no image downloading, no DB writes

// Input: FormData with field 'file' (text/csv)
// 
// Parse CSV:
//   Use a lightweight CSV parser — papaparse (already installed)
//   import Papa from 'papaparse'
//   const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
//
// Extract from each row:
//   name:        row['Name'] || row['name'] || row['post_title']
//   images:      row['Images'] || row['images'] || row['image'] || ''
//                Split by comma, trim each URL, filter empty
//                Take first 5 URLs maximum
//   description: row['Description'] || row['description'] || ''
//                Strip HTML tags: description.replace(/<[^>]*>/g, '').trim()
//                Truncate to 500 chars
//   shortDesc:   row['Short description'] || row['short_description'] || ''
//   sku:         row['SKU'] || row['sku'] || ''
//   stock:       parseInt(row['Stock'] || row['stock'] || '0') || 0
//
// Filter out:
//   Rows with no name (skip)
//   Rows where name is empty string (skip)
//
// Return preview array (no DB operations):
// {
//   total: number,
//   products: {
//     rowIndex: number,       // position in CSV (for reference)
//     name: string,
//     slug: string,           // generate from name: slugify(name)
//     imageUrls: string[],    // raw WooCommerce URLs (not yet on Cloudinary)
//     firstImageUrl: string,  // first image for preview thumbnail
//     description: string,
//     sku: string,
//     stock: number,
//     isDuplicate: boolean,   // true if slug already exists in DB
//   }[]
// }
//
// isDuplicate check:
//   After parsing all rows, do ONE batch DB query:
//   const existingSlugs = await prisma.product.findMany({
//     where: { slug: { in: allSlugs } },
//     select: { slug: true }
//   })
//   Mark each product.isDuplicate = existingSlugs.includes(product.slug)
//
// Limit: if CSV has > 500 rows, return first 500 with a warning
// Error handling: if CSV is malformed, return { error: "Invalid CSV format" }
```

### A2 — Import Execute API

**Create `src/app/api/admin/import/execute/route.ts`** (POST):

```typescript
// Input: JSON body
// {
//   selectedIndices: number[],  // rowIndex values from preview
//   products: PreviewProduct[]  // the full preview array
// }
//
// This is the heavy route — downloads and uploads images to Cloudinary
// Uses streaming response (Server-Sent Events) to report progress
//
// STREAMING RESPONSE PATTERN:
// Return a ReadableStream so the client sees progress in real-time:
//
// const stream = new ReadableStream({
//   async start(controller) {
//     const encoder = new TextEncoder()
//     
//     function send(data: object) {
//       controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
//     }
//     
//     const selectedProducts = products.filter(p => selectedIndices.includes(p.rowIndex))
//     
//     send({ type: 'start', total: selectedProducts.length })
//     
//     for (const [i, product] of selectedProducts.entries()) {
//       send({ type: 'progress', current: i + 1, total: selectedProducts.length, name: product.name })
//       
//       try {
//         // 1. Download + upload images to Cloudinary
//         const cloudinaryUrls: string[] = []
//         
//         for (const imageUrl of product.imageUrls.slice(0, 5)) {
//           try {
//             // Fetch image as buffer
//             const imageResponse = await fetch(imageUrl, {
//               signal: AbortSignal.timeout(10000)  // 10s timeout per image
//             })
//             if (!imageResponse.ok) continue
//             
//             const buffer = await imageResponse.arrayBuffer()
//             const base64 = Buffer.from(buffer).toString('base64')
//             const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
//             const dataUri = `data:${mimeType};base64,${base64}`
//             
//             // Upload to Cloudinary
//             const uploadResult = await cloudinary.uploader.upload(dataUri, {
//               folder: 'prudent-gabriel/products',
//               transformation: [
//                 { width: 1200, crop: 'limit' },
//                 { quality: 'auto' },
//                 { fetch_format: 'auto' },
//               ],
//             })
//             
//             cloudinaryUrls.push(uploadResult.secure_url)
//           } catch (imgError) {
//             // Skip failed images — continue with others
//             console.error(`Failed to upload image for ${product.name}:`, imgError)
//           }
//         }
//         
//         // 2. Generate unique slug (handle duplicates by appending number)
//         let slug = slugify(product.name)
//         let slugSuffix = 0
//         while (true) {
//           const existing = await prisma.product.findUnique({
//             where: { slug: slugSuffix === 0 ? slug : `${slug}-${slugSuffix}` }
//           })
//           if (!existing) {
//             slug = slugSuffix === 0 ? slug : `${slug}-${slugSuffix}`
//             break
//           }
//           slugSuffix++
//         }
//         
//         // 3. Create Product in DB (DRAFT — not published)
//         const newProduct = await prisma.product.create({
//           data: {
//             name: product.name,
//             slug,
//             description: product.description || '',
//             details: '',
//             category: 'CASUAL',     // Default — admin changes manually
//             type: 'RTW',            // Default
//             tags: [],
//             basePriceNGN: 0,        // ₦0 — admin MUST set before publishing
//             isPublished: false,     // DRAFT
//             isFeatured: false,
//             isNewArrival: false,
//             isBespokeAvail: false,
//             inStock: product.stock > 0,
//             images: {
//               create: cloudinaryUrls.map((url, idx) => ({
//                 url,
//                 alt: product.name,
//                 isPrimary: idx === 0,
//                 sortOrder: idx,
//               }))
//             },
//             variants: {
//               create: [{
//                 size: 'One Size',   // Default variant — admin edits
//                 sku: product.sku || `PG-${slug.toUpperCase().slice(0, 8)}`,
//                 priceNGN: 0,        // ₦0 — must be set
//                 stock: Math.max(product.stock, 1),
//                 lowStockAt: 3,
//                 sortOrder: 0,
//               }]
//             }
//           }
//         })
//         
//         send({
//           type: 'product_done',
//           current: i + 1,
//           total: selectedProducts.length,
//           name: product.name,
//           productId: newProduct.id,
//           imageCount: cloudinaryUrls.length,
//         })
//         
//       } catch (productError) {
//         send({
//           type: 'product_error',
//           current: i + 1,
//           total: selectedProducts.length,
//           name: product.name,
//           error: productError instanceof Error ? productError.message : 'Unknown error',
//         })
//       }
//     }
//     
//     send({ type: 'complete', imported: selectedProducts.length })
//     controller.close()
//   }
// })
//
// return new Response(stream, {
//   headers: {
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     'Connection': 'keep-alive',
//   }
// })
```

---

## TASK B — ADMIN IMPORT PAGE

**Create `src/app/(admin)/admin/import/page.tsx`** (Server Component):

```typescript
// Simple server wrapper
// Render ImportPageClient
// Title metadata: "Import Products | Admin"
```

Add to AdminSidebar under CATALOGUE:
```typescript
// Icon: Upload (Lucide)
// Label: "Import Products"
// Href: /admin/import
// Position: below "Products"
```

**Create `src/components/admin/ImportPageClient.tsx`** (client component):

```
PAGE HEADER:
  "Import Products" (Bodoni Moda 24px)
  "Import products from a WooCommerce CSV export" (Jost 13px, dark-grey)

The page has 3 steps shown as a stepper:
  [1 Upload CSV] → [2 Preview & Select] → [3 Importing]

── STEP 1: UPLOAD CSV ──────────────────────────────────────

STATE: step = 1

INSTRUCTIONS CARD (bg-[#FAFAF8], border 1px #EBEBEA, p-6, mb-6):
  "How to export from WooCommerce:"
  
  Numbered steps (Jost 13px):
  1. Log into your WordPress admin
  2. Go to WooCommerce → Products → All Products
  3. Click [Export] at the top of the page
  4. Select "All columns" OR just ensure Name and Images are included
  5. Click [Generate CSV] and download the file
  6. Upload the downloaded CSV file below

UPLOAD ZONE (large, centered):
  Border: 2px dashed #EBEBEA
  hover + drag-over: border-olive bg-olive/5
  Padding: 48px
  
  Icon: Upload (Lucide, 32px, #A8A8A4)
  Text: "Drop your WooCommerce CSV here"
  Sub: "or click to browse" (Jost 12px, dark-grey)
  Accepted: ".csv files only"
  
  <input type="file" accept=".csv" className="sr-only" ref={fileInputRef} />
  
  On file select (drag or click):
    Validate: file.name.endsWith('.csv')
    If not CSV: show error "Please upload a CSV file"
    Show selected file name + size
    [Parse CSV] button appears (olive, full-width)

PARSE BUTTON:
  [PARSE CSV & PREVIEW PRODUCTS] (olive, full-width, large)
  
  On click:
    isLoading = true
    POST /api/admin/import/preview (FormData with file)
    On success: set previewData, advance to step 2
    On error: show error message

── STEP 2: PREVIEW & SELECT ────────────────────────────────

STATE: step = 2, previewData loaded

SUMMARY BAR (bg-[#FAFAF8], border 1px #EBEBEA, p-4, mb-6):
  Flex justify-between:
    Left: "[N] products found in CSV"
    Center: "[N] duplicates (already imported)" — amber badge if > 0
    Right: "[N] selected" (olive, updates as checkboxes change)

ACTIONS ROW (mb-4):
  [Select All] button (Jost 11px, outlined)
  [Deselect All] button (Jost 11px, outlined)
  [Select Non-Duplicates] button (Jost 11px, outlined)
  ——
  [← Back] (ghost, left) | [IMPORT SELECTED →] (olive, right, disabled if 0 selected)

DUPLICATE WARNING (if any duplicates in preview):
  Amber info box:
  "⚠️ [N] products appear to already exist (same name/slug).
   Duplicates are unchecked by default. Importing them will create
   additional copies with a number suffix (e.g. 'red-dress-2')."

PRODUCT PREVIEW GRID (4-col desktop, 3-col tablet, 2-col mobile):
  Each product card:
    
    CHECKBOX (top-left, absolute):
      Checked = selected for import
      Duplicate products: unchecked by default, amber border on card
    
    IMAGE PREVIEW (aspect 3/4, bg-[#F2F2F0]):
      <img> src={product.firstImageUrl}
      loading="lazy"
      On error: show grey placeholder with product name initial
    
    CARD BODY (p-3):
      Product name (Jost 13px weight-500, black, line-clamp-2)
      
      SKU (if present): Jost 10px, dark-grey
      
      Images count: "[N] images" (Jost 10px, dark-grey)
      
      DUPLICATE BADGE (if isDuplicate):
        "DUPLICATE" — bg-[#FFF8E7] text-[#92660A], Jost 9px uppercase
      
      CATEGORY (will be set after import):
        "Category: Unassigned" — Jost 10px, dark-grey/60
    
    Selected state: ring-2 ring-olive, bg-olive/5
    Duplicate + selected: ring-2 ring-amber-400

IMPORT BUTTON (sticky bottom bar on mobile):
  "[IMPORT X SELECTED PRODUCTS →]" (olive, large)
  Below button: "Products will be created as drafts. You'll set prices after."

── STEP 3: IMPORTING ────────────────────────────────────────

STATE: step = 3, importing = true/false

PROGRESS DISPLAY:

OVERALL PROGRESS BAR:
  Width: 100%, height: 6px
  Olive fill, animated
  "[X] of [total] products imported"
  Percentage below

CURRENT PRODUCT (large, centered):
  "Importing: [product name]..."
  (Jost 14px, charcoal, updates in real-time via SSE)

LIVE LOG (scrollable list, max-h-64, overflow-y-auto, bg-[#FAFAF8], border 1px #EBEBEA, p-4):
  Monospace-ish display of events:
  Each line:
    ✓  [product name] — [N] images uploaded  (green checkmark, Jost 12px)
    ✗  [product name] — Failed: [error]      (red X, Jost 12px)
    ⟳  [product name] — Importing...         (spinner, current item)

SSE CONNECTION:
  const eventSource = new EventSource('/api/admin/import/execute')
  // Actually: use fetch with ReadableStream (EventSource doesn't support POST)
  
  // Pattern:
  const response = await fetch('/api/admin/import/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedIndices, products: previewData.products }),
  })
  
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const text = decoder.decode(value)
    const lines = text.split('\n').filter(l => l.startsWith('data: '))
    
    for (const line of lines) {
      const data = JSON.parse(line.replace('data: ', ''))
      // Handle: start, progress, product_done, product_error, complete
      // Update progress bar, log, current product name
    }
  }

COMPLETION STATE (after all done):

  Large checkmark (Framer Motion draw, same as checkout success)
  
  "Import Complete!" (Bodoni Moda 28px, black)
  
  RESULTS SUMMARY (cards row):
    ✓ [N] products imported successfully (green)
    ⚠ [N] products had image issues (amber) — images may be missing
    ✗ [N] products failed (red) — if any
  
  IMPORTANT NOTE (olive bg/10, olive border, p-4):
    "📝 All imported products are saved as DRAFTS.
     They are not visible in your store until you:
     1. Set a price for each product
     2. Assign the correct category
     3. Add sizes and variants as needed
     4. Click 'Publish'"
  
  TWO ACTION BUTTONS:
    [VIEW IMPORTED PRODUCTS] → /admin/products?status=draft&sort=newest
      olive, full-width
    [IMPORT MORE] → resets to step 1
      outlined
```

---

## TASK C — ADMIN PRODUCTS PAGE: DRAFT INDICATOR

When admin views `/admin/products`, imported draft products need clear visual treatment:

**Update `src/components/admin/ProductsTable.tsx`**:

```typescript
// For products where isPublished: false AND basePriceNGN === 0:
//   Add "⚠️ Price needed" badge (amber) next to product name
//   This makes it obvious which imported products still need pricing

// Add filter option in toolbar:
//   Status dropdown: All | Published | Draft | "Needs Price" (isPublished=false + price=0)

// "Needs Price" filter:
//   GET /api/admin/products?needsPrice=true
//   In API: where: { isPublished: false, basePriceNGN: 0 }
```

---

## TASK D — QUICK PRICE EDIT IN PRODUCTS TABLE

To make pricing imported products fast, add inline price editing:

**Update `src/components/admin/ProductsTable.tsx`**:

```typescript
// For rows where basePriceNGN === 0 (needs price):
//   Show price cell as editable input instead of static text:
//   
//   [₦ ___________] — text input, placeholder "Set price"
//   On blur or Enter: PATCH /api/admin/products/[id] { basePriceNGN: value }
//                     Also update the default variant's priceNGN
//   Immediate toast: "Price saved ✓"
//   
//   This lets admin price 50+ products without opening each edit page
//
// Only show inline edit for price = 0 products
// Published products with real prices show static text as before
```

---

## TASK E — HOW TO EXPORT FROM WOOCOMMERCE (Guide)

Create a help page for the admin:

**Create `src/app/(admin)/admin/import/help/page.tsx`**:

```
Simple static page (no DB needed)

CONTENT:
  "How to Export Products from WooCommerce"
  
  Step-by-step with screenshots descriptions:
  
  Step 1: Log into WordPress Admin
    URL: yourstore.com/wp-admin
  
  Step 2: Go to Products
    WooCommerce → Products → All Products
  
  Step 3: Click Export
    Look for the "Export" button at the top of the products list
  
  Step 4: Configure Export
    - Set "Which product types" → All products
    - Set "Which columns" → All columns (or at minimum: Name, Images)
    - Set "Which product category" → All categories
    - Set "How many" → All products
    - Leave other settings as default
  
  Step 5: Generate and Download
    Click "Generate CSV" — the file downloads automatically
  
  Step 6: Upload to Prudent Gabriel
    Go back to Import Products → Upload the CSV file
  
  TIPS:
  - The CSV file should be named something like "wc-product-export-[date].csv"
  - File size: typically 1-5MB for 200 products with image URLs
  - Images must still be accessible at their original URLs during import
    (the WooCommerce store must be online during the import process)
  
  TROUBLESHOOTING:
  - "No products found": Check the CSV has a "Name" column
  - "Images not loading": The WooCommerce store might have blocked the image URLs
    (try importing without closing the WooCommerce store)
  - "Duplicate products": These already exist — uncheck them before importing

[← Back to Import] link
```

---

## TASK F — SEED: ADD IMPORT PRODUCT TO SIDEBAR

Verify `/admin/import` is in the sidebar. If not:

**Update `src/components/admin/AdminSidebar.tsx`**:
```typescript
// Under CATALOGUE, after Products:
{
  icon: Upload,
  label: 'Import Products',
  href: '/admin/import',
}
```

---

## FINAL CHECKS

```bash
npx tsc --noEmit    # must pass
npx next build      # must pass
```

Verify:
```
/admin/import              → Step 1: file upload zone
/admin/import              → Upload a WooCommerce CSV → Step 2: preview grid
/admin/import              → Select products → click Import → Step 3: progress bar
/admin/import              → SSE progress updates in real-time
/admin/import              → Completion screen with results summary
/admin/products            → Draft products show "⚠️ Price needed" badge
/admin/products            → Price = 0 rows show inline price input
/admin/import/help         → Export instructions page
AdminSidebar               → "Import Products" link under CATALOGUE
```

---

## IMPORTANT NOTES FOR MRS. PRUDENT'S WORKFLOW

After import:
1. Go to `/admin/products?needsPrice=true` — shows all imported products needing prices
2. For each product: type the price directly in the table (no need to open edit page)
3. Once price is set, open the product and:
   - Assign the correct category (Casual, Evening, Formal, etc.)
   - Add sizes/variants if needed (or keep "One Size")
   - Click Publish
4. Product goes live immediately

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 14 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Import APIs (CSV parse/preview + execute with SSE streaming)
✅ Task B — /admin/import page (3-step: upload → preview → importing)
✅ Task C — Draft indicator in products table ("⚠️ Price needed" badge)
✅ Task D — Inline price editing for price=0 products
✅ Task E — Export help page (/admin/import/help)
✅ Task F — Sidebar link added

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 14 — WooCommerce CSV Import*
*Prepared by Nony | SonsHub Media*
