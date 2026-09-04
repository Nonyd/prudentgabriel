import Link from "next/link";
import { PrintGuideButton } from "./PrintGuideButton";

function Must() {
  return (
    <span className="ml-2 inline-block rounded-sm bg-wine px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-gold">
      Must fill
    </span>
  );
}

function Skip() {
  return (
    <span className="ml-2 inline-block rounded-sm border border-sand px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-[#A8A8A4]">
      Skip if unsure
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
      <h2 className="flex items-baseline gap-3 font-display text-xl text-gold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine font-sans text-sm text-gold">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 font-body text-[15px] leading-relaxed text-charcoal">{children}</div>
    </section>
  );
}

export function ProductUploadGuide() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-[#A8A8A4] hover:text-gold print:hidden">
            ← Products
          </Link>
          <h1 className="mt-2 font-display text-3xl text-charcoal">How to upload a new product</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#6B6B68]">
            Follow this page from top to bottom. You do not need to be technical. If a box says
            “Skip if unsure”, leave it empty.
          </p>
        </div>
        <PrintGuideButton />
      </header>

      <div className="rounded-sm border border-wine/30 bg-wine/5 p-5 print:break-inside-avoid">
        <p className="font-display text-lg text-wine">Three rules</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-charcoal">
          <li>
            Do <strong>not</strong> click <strong>Publish</strong> until photos, naira price, sizes, and stock
            numbers are filled in.
          </li>
          <li>
            Click <strong>Save draft</strong> often. If you close the tab without saving, the product is lost.
          </li>
          <li>
            After you publish, open the shop and look at the product the way a customer would.
          </li>
        </ol>
      </div>

      <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-gold">Before you sit down</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-charcoal">
          Get these ready on your computer or phone:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-charcoal">
          <li>The product name (exactly as it should appear, for example “The Avril Gown”).</li>
          <li>
            At least <strong>2 photos</strong>, ideally 4–6. First photo = front. Second photo = the look that
            should appear when someone hovers on the shop.
          </li>
          <li>The naira price for each size (or one price if every size costs the same).</li>
          <li>How many pieces you have of each size (the stock count).</li>
          <li>
            A short sentence about the piece, plus fabric and care notes if you have them.
          </li>
        </ul>
        <div className="mt-4 rounded-sm bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-950">
          <strong>iPhone photos:</strong> the website does <em>not</em> accept HEIC files. Save or export as
          JPG or PNG first. On iPhone: Settings → Camera → Formats → Most Compatible. Or AirDrop / share
          the photo and choose JPG.
        </div>
        <p className="mt-3 text-[14px] text-[#6B6B68]">
          Allowed photo types: JPG, JPEG, PNG, or WebP. Each photo must be under 5 MB. Do not upload PDF,
          Word, GIF, or video here.
        </p>
      </section>

      <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-gold">Two ways to add a product</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-sm border border-gold/40 bg-gold/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">Easier — use this if you can</p>
            <p className="mt-2 font-display text-lg text-charcoal">Copy a similar product</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-charcoal">
              <li>Open Products and find a piece that is almost the same.</li>
              <li>Click the name to open it.</li>
              <li>Click <strong>Duplicate</strong> at the top.</li>
              <li>Change the name, photos, price, and stock.</li>
              <li>Save draft, check, then Publish.</li>
            </ol>
            <p className="mt-2 text-[13px] text-[#6B6B68]">
              Duplicate makes an unpublished copy. Customers cannot see it until you publish.
            </p>
          </div>
          <div className="rounded-sm border border-sand p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#A8A8A4]">From scratch</p>
            <p className="mt-2 font-display text-lg text-charcoal">Start with a blank form</p>
            <p className="mt-2 text-[14px] leading-relaxed text-charcoal">
              Use this when there is no similar product to copy. Follow steps 1–8 below.
            </p>
          </div>
        </div>
      </section>

      <Step n={1} title="Log in and open Products">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Go to the staff login:{" "}
            <a href="https://prudentgabriel.com/login?tab=staff" className="text-gold underline">
              prudentgabriel.com/login
            </a>{" "}
            (choose Staff).
          </li>
          <li>Type the email and password your manager gave you. Click Sign in.</li>
          <li>
            In the left menu, open <strong>Shop</strong>, then click <strong>Products</strong>.
          </li>
          <li>
            Click the wine-coloured <strong>+ Add product</strong> button at the top right.
          </li>
        </ol>
        <p className="text-[14px] text-[#6B6B68]">
          Only use staging.prudentgabriel.com if your manager told you to practise there. The live shop
          is prudentgabriel.com.
        </p>
      </Step>

      <Step n={2} title="Name and description">
        <p>
          <strong>Product name</strong>
          <Must />
          <br />
          Type the name customers should see. Example: <em>The Avril Gown</em>.
          Click outside the box when you are done. The <strong>Slug</strong> fills itself. Leave the slug
          alone.
        </p>
        <p>
          <strong>Short description</strong>
          <Skip />
          <br />
          One or two sentences. Maximum 200 characters. This is a quick summary, not the full story.
        </p>
        <p>
          <strong>Full description</strong>
          <Must />
          <br />
          Write the product story here. Include fabric, lining, and care instructions in this same box
          (for example: “Dry clean only. Lined. Concealed back zip.”). This text appears on the product
          page under “Product Details”.
        </p>
        <p className="text-[14px] text-[#6B6B68]">
          If you also see a box called “Materials &amp; care”, you can leave it. It currently shares the
          same text as Full description.
        </p>
      </Step>

      <Step n={3} title="Upload photos">
        <p>
          Click the dashed box that says <strong>Drop images here or click to upload</strong>. Select
          your photos. You can select several at once. Wait until it says “Images uploaded”.
        </p>
        <p>Order matters. Upload in this order (or set Primary after):</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Photo 1 — Primary (★)</strong> — the main front shot. This is what shoppers see first
            on the shop and in search.
          </li>
          <li>
            <strong>Photo 2</strong> — a second angle. When someone moves their mouse over the product on
            the shop, this photo appears.
          </li>
          <li>
            <strong>Photos 3–6</strong> — back, fabric close-up, styling. Nice to have, not required.
          </li>
        </ol>
        <p>
          To make a photo the main one, click <strong>☆ Set primary</strong> under it. The gold ★ means
          that photo is the main one.
        </p>
        <p>
          To delete a photo, click <strong>Remove</strong>. If you remove the primary photo, the next one
          becomes primary automatically.
        </p>
        <p className="text-[14px] text-[#6B6B68]">
          You need at least two photos for the hover change to work on the shop. One photo is allowed, but
          nothing will swap on hover.
        </p>
      </Step>

      <Step n={4} title="Price, sizes, and stock">
        <p>
          This is the part that makes the product buyable. Please go slowly.
        </p>
        <p>
          <strong>Starting ₦ for new sizes</strong>
          <Must />
          <br />
          Type the naira price, for example <em>185000</em> (no commas, no ₦ sign). The form starts at
          1000 — that is only a placeholder. Change it.
        </p>
        <p>
          <strong>Base $ and Base £</strong>
          <Skip />
          <br />
          Leave these empty. The website will convert from naira. Only fill them if your manager gave you
          a fixed dollar or pound selling price.
        </p>
        <p>
          <strong>Default kg / L / W / H</strong>
          <Skip />
          <br />
          Parcel weight and size for shipping. Leave blank unless you have measured the packed garment.
        </p>
        <p>
          <strong>Sizes</strong>
          <Must />
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Tick the sizes you sell (XS, S, M, L, XL, XXL). Un-tick sizes you do not have.
          </li>
          <li>
            Click <strong>Generate size rows</strong>. This creates one row per size.
          </li>
          <li>
            Click <strong>Copy ₦… onto every size</strong> if every size is the same price. Then change
            any size that costs more or less.
          </li>
          <li>
            In each row, fill <strong>Stock</strong> with how many pieces you have of that size. Use 0 if
            that size is sold out. If stock is 0, customers cannot buy that size.
          </li>
        </ol>
        <p>
          <strong>SKU</strong> fills itself (it looks like PA-AVRIL-M). Leave it.
        </p>
        <p>
          <strong>Low at</strong> is usually 3. That means you get a low-stock warning when 3 are left.
          You can leave it.
        </p>
        <p>
          Need a size that is not in the list (for example 8, 10, 12, or One Size)? Click{" "}
          <strong>+ Add size</strong> and type the size name in the Size box.
        </p>
        <div className="rounded-sm bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-950">
          You must keep at least one size row. Do not delete the last row.
        </div>
      </Step>

      <Step n={5} title="Sale prices (only if it is on sale)">
        <p>Skip this whole step if the product is not on sale.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Tick <strong>Product is on sale</strong>.</li>
          <li>
            On each size row, type the sale naira price in the <strong>Sale ₦</strong> column. This must
            be lower than the regular ₦ price.
          </li>
        </ol>
        <p>
          If you fill Sale ₦ but forget to tick “Product is on sale”, shoppers still pay the regular
          price. Both are required.
        </p>
      </Step>

      <Step n={6} title="Colours, Complete the Look, and SEO">
        <p>
          <strong>Colours</strong>
          <Skip />
          <br />
          Only if the same product comes in more than one colour. Click <strong>+ Add colour</strong>,
          type the colour name (Ivory, Black), and pick the colour square. Leave Image URL empty unless
          your manager gave you a link.
        </p>
        <p>
          <strong>Complete the Look</strong>
          <Skip />
          <br />
          Optional. Search for up to 4 other published products shoppers might add with this piece
          (shoes, a wrap, jewellery).
        </p>
        <p>
          <strong>SEO (Meta title and Meta description)</strong>
          <Skip />
          <br />
          Leave empty. Google will use the product name and description.
        </p>
      </Step>

      <Step n={7} title="The right-hand boxes (Status and Organisation)">
        <p>
          <strong>Category</strong>
          <Must />
          <br />
          Choose the closest match: Bridal, Evening Wear, Casual, Formal, Kiddies, or Accessories.
        </p>
        <p>
          <strong>Product type</strong>
          <Must />
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>RTW</strong> — ready to wear. The piece is made and in stock. Most shop products are
            this.
          </li>
          <li>
            <strong>Bespoke</strong> — made to order / by commission. Only choose this if that is truly
            the case.
          </li>
        </ul>
        <p>
          <strong>Tags</strong>
          <Skip />
          <br />
          Optional labels, separated by commas. Example: <em>bridal, autumn-2026</em>. If a collection
          uses an auto-tag, putting that same tag here will add the product to that collection
          automatically after you publish.
        </p>
        <p className="font-medium">The ticks on the right:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Published</strong> — leave this off while you work. Use the Publish button at the top
            when everything is ready.
          </li>
          <li>
            <strong>Featured</strong> — only tick if your manager asked for this piece to be highlighted.
          </li>
          <li>
            <strong>New arrival</strong> — tick for new pieces. Shoppers see a “New” badge. Untick later
            when it is no longer new.
          </li>
          <li>
            <strong>Bespoke available</strong> — tick if customers can also commission a made-to-measure
            version of this RTW piece. On ready-to-wear pages that offer is not shown next to the size picker;
            they book through Atelier.
          </li>
          <li>
            <strong>Offer custom</strong> — she can enter measurements while sizes are in stock.
            <strong> Keep offering after sold out</strong> stays off unless the fabric can be sourced again.
            If it is off, a sold-out piece shows Notify me, not a remake.
          </li>
        </ul>
      </Step>

      <Step n={8} title="Save draft, check, then Publish">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Click <strong>Save draft</strong> at the top. You should see “Product created” or “Changes
            saved”. The page will reopen in Edit mode.
          </li>
          <li>Scroll through once more. Check name, photos, each size’s price, and each size’s stock.</li>
          <li>
            When it is ready for customers, click the wine <strong>Publish</strong> button.
          </li>
          <li>
            Open a new browser tab and go to the shop. Search for the product name, or open{" "}
            <code className="rounded-sm bg-[#F5F5F3] px-1 text-[13px]">prudentgabriel.com/shop/</code>{" "}
            plus the slug shown under the name box.
          </li>
        </ol>
        <p>
          If something looks wrong, come back to the product, fix it, and click <strong>Save draft</strong>{" "}
          (if you want it hidden) or <strong>Publish</strong> again (to keep it live with the fixes).
        </p>
        <p>
          To hide a live product without deleting it: open it, untick Published, then click Save draft.
          Or on the Products list, switch the Published toggle off.
        </p>
      </Step>

      <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-gold">Put it in a collection</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-charcoal">
          Publishing does not automatically put the product in a collection page (for example a named
          launch). Do this after the product exists:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-charcoal">
          <li>
            Left menu: <strong>Shop</strong> → <strong>Collections</strong>.
          </li>
          <li>Click the collection name.</li>
          <li>Click <strong>Edit collection</strong>.</li>
          <li>
            Under <strong>Also include these products</strong>, type the product name, then click it in
            the list.
          </li>
          <li>Save the collection.</li>
        </ol>
        <p className="mt-3 text-[14px] text-[#6B6B68]">
          If the collection has an auto-tag, you can instead put that same tag on the product (step 7)
          and skip the manual search — but the product must be published for auto-tag to pick it up.
        </p>
      </section>

      <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-gold">Change an existing product</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-charcoal">
          <li>Go to Products.</li>
          <li>Use the search box to find the name.</li>
          <li>Click the product name.</li>
          <li>Change what you need. Click Save draft or Publish when finished.</li>
        </ol>
        <p className="mt-3 text-[15px] leading-relaxed text-charcoal">
          On the Products list you can also:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-charcoal">
          <li>Turn Published on or off with the switch.</li>
          <li>Turn Featured or New on or off with the switches.</li>
          <li>
            Change the naira price inline only if the product has <em>one</em> size. If it has several
            sizes, click the name and edit each size row.
          </li>
        </ul>
        <p className="mt-3 text-[14px] text-[#6B6B68]">
          Do not click Delete unless you are sure. Deleted products cannot be brought back. Hide with
          Unpublish instead.
        </p>
      </section>

      <section className="rounded-sm border border-sand bg-canvas p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-gold">If something goes wrong</h2>
        <dl className="mt-4 space-y-4 text-[15px] leading-relaxed text-charcoal">
          <div>
            <dt className="font-medium">The page says the name or slug is too short / invalid</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Name needs at least 2 characters. Slug should be lowercase letters, numbers, and hyphens
              only — click outside the name box and let it fill itself.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upload failed / file is too large / only JPEG PNG or WebP</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Convert HEIC or GIF to JPG. Make sure the file is under 5 MB. Try one photo at a time.
            </dd>
          </div>
          <div>
            <dt className="font-medium">I cannot click Publish / I see a red note about variants</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Every size row needs a size name, a price of at least 1, and a stock number (0 is allowed).
              Starting ₦ cannot be 0.
            </dd>
          </div>
          <div>
            <dt className="font-medium">The product is live but says sold out</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Stock is 0 on every size. Open the product and type the real stock numbers, then save.
            </dd>
          </div>
          <div>
            <dt className="font-medium">The product is not on the shop</dt>
            <dd className="mt-1 text-[#6B6B68]">
              It is still a draft. Click Publish. Also check you are looking at prudentgabriel.com, not
              staging.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Hover does not change the photo</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Upload a second photo. The second photo is the hover image.
            </dd>
          </div>
          <div>
            <dt className="font-medium">A photo shows “Hosted on old server”</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Open the product (Edit) and click “Re-upload to Cloudinary”. Wait until it finishes.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Sale price is filled but customers still see the old price</dt>
            <dd className="mt-1 text-[#6B6B68]">
              Tick “Product is on sale”, then Publish / save again.
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-sm border border-wine/30 bg-wine/5 p-6 print:break-inside-avoid">
        <h2 className="font-display text-xl text-wine">Printable checklist</h2>
        <p className="mt-2 text-[14px] text-[#6B6B68]">Tick these before you click Publish.</p>
        <ul className="mt-4 space-y-2 text-[15px] text-charcoal">
          {[
            "Name is spelled correctly",
            "Slug was left alone (filled itself)",
            "Full description includes fabric and care",
            "At least 2 photos uploaded",
            "The front shot is marked ★ Primary",
            "Starting ₦ is the real price, not 1000",
            "Every size you sell has a row",
            "Every size has the correct stock number",
            "Category and RTW / Bespoke are correct",
            "If on sale: tick is on AND Sale ₦ is filled",
            "I clicked Save draft first and checked the page",
            "After Publish, I opened the shop and looked at it",
            "If it belongs in a collection, I added it there",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-sm border border-sand bg-canvas" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-[#A8A8A4] print:hidden">
        Stuck? Ask your manager before deleting anything.{" "}
        <Link href="/admin/products/new" className="text-gold underline">
          Add a product now
        </Link>
      </p>
    </article>
  );
}
