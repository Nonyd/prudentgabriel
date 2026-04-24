import bcrypt from "bcryptjs";
import {
  PrismaClient,
  CouponType,
  ProductCategory,
  ProductType,
  Role,
  BespokeStatus,
  OrderStatus,
  PaymentStatus,
  PaymentGateway,
  Currency,
  ConsultationSessionType,
  ConsultationDeliveryMode,
  ConsultationStatus,
  SettingGroup,
  SettingType,
} from "@prisma/client";

const prisma = new PrismaClient();

const IMG = {
  bridal: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
  evening: "https://images.unsplash.com/photo-1566174053879-435285eff2e8?w=800",
  formal: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
  casual: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800",
  kiddies: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800",
  accessories: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
  bridal2: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=800",
};

type VariantSeed = { size: string; priceNGN: number; salePriceNGN?: number | null; stock: number };

type ProductSeed = {
  name: string;
  slug: string;
  description: string;
  details?: string;
  category: ProductCategory;
  type: ProductType;
  basePriceNGN: number;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;
  saleEndsAt?: Date;
  isBespokeAvail?: boolean;
  tags: string[];
  images: { url: string; alt: string; isPrimary: boolean; sortOrder: number }[];
  variants: VariantSeed[];
  colors?: { name: string; hex: string }[];
};

const saleEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

const PRODUCTS: ProductSeed[] = [
  {
    name: "Amore Bridal Gown",
    slug: "amore-bridal-gown",
    description: "Hand-beaded couture bridal gown with cathedral train.",
    details: "<p>Silk organza base with hand-applied pearl and crystal embroidery.</p>",
    category: ProductCategory.BRIDAL,
    type: ProductType.BESPOKE,
    basePriceNGN: 1_850_000,
    isFeatured: true,
    isNewArrival: true,
    isBespokeAvail: true,
    tags: ["Bridal", "Evening"],
    images: [
      { url: IMG.bridal, alt: "Amore Bridal Gown", isPrimary: true, sortOrder: 0 },
      { url: IMG.bridal2, alt: "Amore detail", isPrimary: false, sortOrder: 1 },
    ],
    variants: [
      { size: "UK8", priceNGN: 1_850_000, stock: 2 },
      { size: "UK10", priceNGN: 1_900_000, stock: 3 },
      { size: "UK12", priceNGN: 1_950_000, stock: 1 },
    ],
    colors: [
      { name: "Ivory", hex: "#FFFFF0" },
      { name: "Champagne", hex: "#F7E7CE" },
    ],
  },
  {
    name: "Ebony Evening Dress",
    slug: "ebony-evening-dress",
    description: "Floor-length sequin evening gown with sculptural neckline.",
    details: "<p>Stretch sequin mesh. Fully lined.</p>",
    category: ProductCategory.EVENING_WEAR,
    type: ProductType.RTW,
    basePriceNGN: 420_000,
    isFeatured: true,
    isOnSale: true,
    saleEndsAt: saleEnd,
    tags: ["Evening", "Bridal"],
    images: [
      { url: IMG.evening, alt: "Ebony Evening Dress", isPrimary: true, sortOrder: 0 },
      { url: IMG.formal, alt: "Ebony alternate", isPrimary: false, sortOrder: 1 },
    ],
    variants: [
      { size: "XS", priceNGN: 450_000, salePriceNGN: 360_000, stock: 4 },
      { size: "S", priceNGN: 450_000, salePriceNGN: 360_000, stock: 5 },
      { size: "M", priceNGN: 450_000, salePriceNGN: 360_000, stock: 2 },
      { size: "L", priceNGN: 450_000, salePriceNGN: 360_000, stock: 0 },
    ],
    colors: [{ name: "Black", hex: "#1a1a1a" }],
  },
  {
    name: "Lagos Power Suit",
    slug: "lagos-power-suit",
    description: "Tailored double-breasted suit in Italian wool blend.",
    category: ProductCategory.FORMAL,
    type: ProductType.RTW,
    basePriceNGN: 285_000,
    isNewArrival: true,
    tags: ["Corporate", "Evening"],
    images: [{ url: IMG.formal, alt: "Lagos Power Suit", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "UK8", priceNGN: 285_000, stock: 6 },
      { size: "UK10", priceNGN: 295_000, stock: 4 },
      { size: "UK12", priceNGN: 305_000, stock: 3 },
    ],
    colors: [
      { name: "Navy", hex: "#1B2838" },
      { name: "Charcoal", hex: "#36454F" },
    ],
  },
  {
    name: "Celestial Sequin Gown",
    slug: "celestial-sequin-gown",
    description: "Ombré sequin column gown for gala nights.",
    category: ProductCategory.EVENING_WEAR,
    type: ProductType.RTW,
    basePriceNGN: 520_000,
    tags: ["Evening"],
    images: [{ url: IMG.evening, alt: "Celestial Sequin Gown", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "S", priceNGN: 520_000, stock: 2 },
      { size: "M", priceNGN: 540_000, stock: 2 },
      { size: "L", priceNGN: 560_000, stock: 1 },
    ],
  },
  {
    name: "Ivy Casual Set",
    slug: "ivy-casual-set",
    description: "Linen co-ord with wide-leg trousers and cropped shirt.",
    category: ProductCategory.CASUAL,
    type: ProductType.RTW,
    basePriceNGN: 125_000,
    tags: ["Casual"],
    images: [{ url: IMG.casual, alt: "Ivy Casual Set", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "XS", priceNGN: 125_000, stock: 8 },
      { size: "S", priceNGN: 125_000, stock: 10 },
      { size: "M", priceNGN: 130_000, stock: 7 },
    ],
  },
  {
    name: "Kiddies Party Dress",
    slug: "kiddies-party-dress",
    description: "Tulle party dress with satin sash.",
    category: ProductCategory.KIDDIES,
    type: ProductType.RTW,
    basePriceNGN: 68_000,
    tags: ["Kiddies"],
    images: [{ url: IMG.kiddies, alt: "Kiddies Party Dress", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "Age 4-5", priceNGN: 68_000, stock: 5 },
      { size: "Age 6-7", priceNGN: 72_000, stock: 4 },
      { size: "Age 8-10", priceNGN: 76_000, stock: 3 },
    ],
  },
  {
    name: "Silk Scarf — Niger",
    slug: "silk-scarf-niger",
    description: "Hand-rolled silk twill scarf with custom print.",
    category: ProductCategory.ACCESSORIES,
    type: ProductType.RTW,
    basePriceNGN: 45_000,
    tags: ["Traditional"],
    images: [{ url: IMG.accessories, alt: "Silk Scarf", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "One Size", priceNGN: 45_000, stock: 20 },
    ],
  },
  {
    name: "Aso-Ebi Formal Gown",
    slug: "aso-ebi-formal-gown",
    description: "Structured mermaid gown for group orders.",
    category: ProductCategory.FORMAL,
    type: ProductType.BESPOKE,
    basePriceNGN: 380_000,
    isBespokeAvail: true,
    tags: ["Traditional", "Corporate"],
    images: [{ url: IMG.formal, alt: "Aso-Ebi Formal Gown", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "UK8", priceNGN: 380_000, stock: 3 },
      { size: "UK10", priceNGN: 400_000, stock: 3 },
      { size: "UK12", priceNGN: 420_000, stock: 2 },
    ],
  },
  {
    name: "Cocktail Midi Dress",
    slug: "cocktail-midi-dress",
    description: "Midi cocktail dress with feather hem.",
    category: ProductCategory.EVENING_WEAR,
    type: ProductType.RTW,
    basePriceNGN: 195_000,
    tags: ["Evening"],
    images: [{ url: IMG.evening, alt: "Cocktail Midi", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "S", priceNGN: 195_000, stock: 4 },
      { size: "M", priceNGN: 195_000, stock: 4 },
      { size: "L", priceNGN: 210_000, stock: 2 },
    ],
  },
  {
    name: "Linen Shirt Dress",
    slug: "linen-shirt-dress",
    description: "Relaxed shirt dress with belt.",
    category: ProductCategory.CASUAL,
    type: ProductType.RTW,
    basePriceNGN: 98_000,
    tags: ["Casual", "Modest"],
    images: [{ url: IMG.casual, alt: "Linen Shirt Dress", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "XS", priceNGN: 98_000, stock: 5 },
      { size: "S", priceNGN: 98_000, stock: 6 },
      { size: "M", priceNGN: 102_000, stock: 4 },
    ],
  },
  {
    name: "Pearl Clutch",
    slug: "pearl-clutch",
    description: "Structured clutch with pearl frame.",
    category: ProductCategory.ACCESSORIES,
    type: ProductType.RTW,
    basePriceNGN: 85_000,
    tags: ["Evening", "Bridal"],
    images: [{ url: IMG.accessories, alt: "Pearl Clutch", isPrimary: true, sortOrder: 0 }],
    variants: [{ size: "One Size", priceNGN: 85_000, stock: 12 }],
  },
  {
    name: "Traditional Buba Set",
    slug: "traditional-buba-set",
    description: "Embroidered buba and iro in aso-oke.",
    category: ProductCategory.CASUAL,
    type: ProductType.BESPOKE,
    basePriceNGN: 220_000,
    isBespokeAvail: true,
    tags: ["Traditional"],
    images: [{ url: IMG.casual, alt: "Buba Set", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "S", priceNGN: 220_000, stock: 2 },
      { size: "M", priceNGN: 240_000, stock: 2 },
      { size: "L", priceNGN: 260_000, stock: 1 },
    ],
  },
  {
    name: "Modest Wrap Dress",
    slug: "modest-wrap-dress",
    description: "Long-sleeve wrap dress with modest coverage.",
    category: ProductCategory.CASUAL,
    type: ProductType.RTW,
    basePriceNGN: 112_000,
    tags: ["Modest", "Corporate"],
    images: [{ url: IMG.casual, alt: "Modest Wrap Dress", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "XS", priceNGN: 112_000, stock: 3 },
      { size: "S", priceNGN: 112_000, stock: 4 },
      { size: "M", priceNGN: 118_000, stock: 3 },
    ],
  },
  {
    name: "Mini-Me Mom Dress",
    slug: "mini-me-mom-dress",
    description: "Coordinating mother-daughter occasion set.",
    category: ProductCategory.KIDDIES,
    type: ProductType.BESPOKE,
    basePriceNGN: 155_000,
    isBespokeAvail: true,
    tags: ["Kiddies", "Bridal"],
    images: [{ url: IMG.kiddies, alt: "Mini-Me", isPrimary: true, sortOrder: 0 }],
    variants: [
      { size: "Age 4-5", priceNGN: 155_000, stock: 2 },
      { size: "Age 6-7", priceNGN: 165_000, stock: 2 },
    ],
  },
];

async function main() {
  await prisma.couponUsage.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bespokeRequest.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.shippingZone.deleteMany();

  await prisma.bundleItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.stockAlert.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productColor.deleteMany();
  await prisma.product.deleteMany();

  const created: { slug: string; id: string }[] = [];

  for (const p of PRODUCTS) {
    const row = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        details: p.details ?? `<p>${p.description}</p>`,
        category: p.category,
        type: p.type,
        priceNGN: p.basePriceNGN,
        basePriceNGN: p.basePriceNGN,
        isPublished: true,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        isOnSale: p.isOnSale ?? false,
        saleEndsAt: p.saleEndsAt ?? null,
        isBespokeAvail: p.isBespokeAvail ?? false,
        tags: p.tags,
        inStock: true,
        images: {
          create: p.images.map((im) => ({
            url: im.url,
            alt: im.alt,
            isPrimary: im.isPrimary,
            sortOrder: im.sortOrder,
          })),
        },
        variants: {
          create: p.variants.map((v, i) => ({
            size: v.size,
            priceNGN: v.priceNGN,
            salePriceNGN: v.salePriceNGN ?? null,
            stock: v.stock,
            sortOrder: i,
          })),
        },
        colors: p.colors?.length
          ? {
              create: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
            }
          : undefined,
      },
    });
    created.push({ slug: row.slug, id: row.id });
  }

  const ebony = created.find((c) => c.slug === "ebony-evening-dress");
  const pearl = created.find((c) => c.slug === "pearl-clutch");
  const scarf = created.find((c) => c.slug === "silk-scarf-niger");

  if (ebony && pearl) {
    await prisma.bundleItem.create({
      data: {
        sourceProductId: ebony.id,
        targetProductId: pearl.id,
        sortOrder: 0,
      },
    });
  }
  if (ebony && scarf) {
    await prisma.bundleItem.create({
      data: {
        sourceProductId: ebony.id,
        targetProductId: scarf.id,
        sortOrder: 1,
      },
    });
  }

  console.log(`Seeded ${created.length} products.`);

  await prisma.shippingZone.createMany({
    data: [
      {
        name: "Lagos — Express",
        countries: ["NG"],
        states: ["Lagos"],
        flatRateNGN: 3500,
        perKgNGN: 400,
        freeAboveNGN: 250_000,
        estimatedDays: "2–4 business days",
        sortOrder: 0,
      },
      {
        name: "Nigeria — Standard",
        countries: ["NG"],
        states: [],
        flatRateNGN: 5500,
        perKgNGN: 600,
        freeAboveNGN: 400_000,
        estimatedDays: "4–7 business days",
        sortOrder: 1,
      },
      {
        name: "International",
        countries: ["*"],
        states: [],
        flatRateNGN: 45_000,
        perKgNGN: 2500,
        freeAboveNGN: null,
        estimatedDays: "10–14 business days",
        sortOrder: 2,
      },
    ],
  });

  const couponSeeds = [
    {
      code: "WELCOME10",
      description: "Welcome — 10% off your first order",
      type: CouponType.PERCENTAGE,
      value: 10,
      appliesToAll: true,
      isActive: true,
      maxUsesPerUser: 1,
      minOrderNGN: null as number | null,
      maxUsesTotal: null as number | null,
      categoryScope: [] as ProductCategory[],
      expiresAt: null as Date | null,
    },
    {
      code: "FREESHIP",
      description: "Free shipping from ₦50,000",
      type: CouponType.FREE_SHIPPING,
      value: 0,
      appliesToAll: true,
      isActive: true,
      maxUsesPerUser: 2,
      minOrderNGN: 50_000,
      maxUsesTotal: null,
      categoryScope: [],
      expiresAt: null,
    },
    {
      code: "BRIDAL20",
      description: "20% off bridal",
      type: CouponType.PERCENTAGE,
      value: 20,
      appliesToAll: false,
      isActive: true,
      maxUsesPerUser: 1,
      minOrderNGN: 150_000,
      maxUsesTotal: 50,
      categoryScope: [ProductCategory.BRIDAL],
      expiresAt: null,
    },
    {
      code: "FLASH5000",
      description: "₦5,000 off",
      type: CouponType.FIXED_AMOUNT,
      value: 5000,
      appliesToAll: true,
      isActive: true,
      maxUsesPerUser: 1,
      minOrderNGN: 80_000,
      maxUsesTotal: 200,
      categoryScope: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      code: "VIP15",
      description: "15% VIP",
      type: CouponType.PERCENTAGE,
      value: 15,
      appliesToAll: true,
      isActive: true,
      maxUsesPerUser: 5,
      minOrderNGN: null,
      maxUsesTotal: null,
      categoryScope: [],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    {
      code: "EXPIRED10",
      description: "Expired sample",
      type: CouponType.PERCENTAGE,
      value: 10,
      appliesToAll: true,
      isActive: false,
      maxUsesPerUser: 1,
      minOrderNGN: null,
      maxUsesTotal: null,
      categoryScope: [],
      expiresAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const c of couponSeeds) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {
        description: c.description,
        type: c.type,
        value: c.value,
        appliesToAll: c.appliesToAll,
        isActive: c.isActive,
        maxUsesPerUser: c.maxUsesPerUser,
        minOrderNGN: c.minOrderNGN,
        maxUsesTotal: c.maxUsesTotal,
        categoryScope: c.categoryScope,
        expiresAt: c.expiresAt,
      },
      create: {
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        appliesToAll: c.appliesToAll,
        isActive: c.isActive,
        maxUsesPerUser: c.maxUsesPerUser,
        minOrderNGN: c.minOrderNGN,
        maxUsesTotal: c.maxUsesTotal,
        categoryScope: c.categoryScope,
        expiresAt: c.expiresAt,
      },
    });
  }

  const adminHash = await bcrypt.hash("Admin@PA2024!", 12);
  await prisma.user.upsert({
    where: { email: "admin@prudentgabriel.com" },
    update: { password: adminHash, role: Role.SUPER_ADMIN, name: "PA Admin" },
    create: {
      email: "admin@prudentgabriel.com",
      name: "PA Admin",
      password: adminHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const custHash = await bcrypt.hash("Customer@2024", 12);
  const customers = ["amara@example.com", "chidinma@example.com", "folake@example.com"];
  for (const em of customers) {
    await prisma.user.upsert({
      where: { email: em },
      update: {},
      create: {
        email: em,
        name: em.split("@")[0].replace(/^\w/, (c) => c.toUpperCase()),
        password: custHash,
        role: Role.CUSTOMER,
      },
    });
  }

  const amaraUser = await prisma.user.findUnique({ where: { email: "amara@example.com" }, select: { id: true } });
  const chidinmaUser = await prisma.user.findUnique({ where: { email: "chidinma@example.com" }, select: { id: true } });
  if (chidinmaUser && amaraUser) {
    await prisma.user.update({
      where: { id: chidinmaUser.id },
      data: { referredById: amaraUser.id },
    });
  }
  if (amaraUser) {
    await prisma.user.update({
      where: { id: amaraUser.id },
      data: { pointsBalance: 2350 },
    });
  }

  const bespokeStatuses: BespokeStatus[] = [
    BespokeStatus.PENDING,
    BespokeStatus.REVIEWED,
    BespokeStatus.CONFIRMED,
    BespokeStatus.IN_PROGRESS,
    BespokeStatus.READY,
    BespokeStatus.DELIVERED,
    BespokeStatus.REVIEWED,
    BespokeStatus.CANCELLED,
  ];
  for (let i = 0; i < 8; i++) {
    const n = String(i + 1).padStart(5, "0");
    await prisma.bespokeRequest.upsert({
      where: { requestNumber: `BQ-2024-${n}` },
      update: {},
      create: {
        requestNumber: `BQ-2024-${n}`,
        name: `Client ${i + 1}`,
        email: `bespoke${i}@example.com`,
        phone: "+2348000000000",
        country: "NG",
        occasion: i % 2 === 0 ? "Wedding" : "Gala",
        description: "Looking for a statement piece with modest tailoring.",
        budgetRange: "₦500k – ₦1m",
        timeline: "3 months",
        status: bespokeStatuses[i] ?? BespokeStatus.REVIEWED,
        referenceImages: [],
      },
    });
  }

  const productsForOrders = await prisma.product.findMany({
    take: 4,
    include: { variants: { take: 1, orderBy: { sortOrder: "asc" } } },
  });
  const orderVariants: {
    status: OrderStatus;
    payment: PaymentStatus;
    gateway: PaymentGateway | null;
  }[] = [
    { status: OrderStatus.PENDING, payment: PaymentStatus.PENDING, gateway: null },
    { status: OrderStatus.CONFIRMED, payment: PaymentStatus.PAID, gateway: PaymentGateway.PAYSTACK },
    { status: OrderStatus.PROCESSING, payment: PaymentStatus.PAID, gateway: PaymentGateway.FLUTTERWAVE },
    { status: OrderStatus.SHIPPED, payment: PaymentStatus.PAID, gateway: PaymentGateway.PAYSTACK },
    { status: OrderStatus.DELIVERED, payment: PaymentStatus.PAID, gateway: PaymentGateway.STRIPE },
    { status: OrderStatus.PENDING, payment: PaymentStatus.PAID, gateway: PaymentGateway.MONNIFY },
    { status: OrderStatus.PROCESSING, payment: PaymentStatus.FAILED, gateway: PaymentGateway.PAYSTACK },
    { status: OrderStatus.CANCELLED, payment: PaymentStatus.PENDING, gateway: null },
  ];

  for (let i = 0; i < 8; i++) {
    const p = productsForOrders[i % Math.max(1, productsForOrders.length)];
    const v = p?.variants[0];
    if (!p || !v) break;
    const orderNumber = `PA-SEED-${2024000 + i}`;
    const line = v.priceNGN;
    const subtotal = line;
    const ship = 3500;
    const ov = orderVariants[i] ?? orderVariants[0];
    await prisma.order.upsert({
      where: { orderNumber },
      update: {},
      create: {
        orderNumber,
        userId: amaraUser?.id ?? null,
        guestEmail: amaraUser ? null : "guest@example.com",
        guestName: amaraUser ? null : "Guest Buyer",
        subtotal,
        shippingAmount: ship,
        discount: 0,
        total: subtotal + ship,
        currency: Currency.NGN,
        paymentStatus: ov.payment,
        status: ov.status,
        paymentGateway: ov.gateway,
        items: {
          create: [
            {
              productId: p.id,
              variantId: v.id,
              quantity: 1,
              price: line,
              lineTotal: line,
              size: v.size,
            },
          ],
        },
      },
    });
  }

  console.log("\n👤 Creating consultants...");
  await prisma.consultant.upsert({
    where: { id: "consultant-prudent" },
    update: {},
    create: {
      id: "consultant-prudent",
      name: "Mrs. Prudent Gabriel-Okopi",
      title: "Founder & Creative Director",
      bio: "The visionary behind Prudential Atelier. Her consultations are rare, intimate, and transformative.",
      image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
      isActive: true,
      isFlagship: true,
      displayOrder: 0,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.BESPOKE_DESIGN,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT,
            durationMinutes: 60,
            feeNGN: 50000,
            feeUSD: 33,
            feeGBP: 26,
            description: "Private virtual design session with Mrs. Gabriel-Okopi.",
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.BRIDAL_CONSULTATION,
            deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT,
            durationMinutes: 120,
            feeNGN: 100000,
            feeUSD: 65,
            feeGBP: 51,
            description: "Full bridal experience at our Lagos atelier.",
            isActive: true,
          },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-senior" },
    update: {},
    create: {
      id: "consultant-senior",
      name: "Senior Design Team",
      title: "Senior Designer · Prudential Atelier",
      bio: "Expert guidance for bespoke pieces and corporate wardrobes.",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 1,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.BESPOKE_DESIGN,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
            durationMinutes: 60,
            feeNGN: 20000,
            feeUSD: 13,
            feeGBP: 10,
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.BRIDAL_CONSULTATION,
            deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER,
            durationMinutes: 90,
            feeNGN: 35000,
            feeUSD: 23,
            feeGBP: 18,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 5, startTime: "09:00", endTime: "14:00", isActive: true },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-team" },
    update: {},
    create: {
      id: "consultant-team",
      name: "Design Team",
      title: "Collective Session · Prudential Atelier",
      bio: "Collaborative group sessions for bridal parties and teams.",
      image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 2,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.GROUP_SESSION,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_WITH_TEAM,
            durationMinutes: 90,
            feeNGN: 35000,
            feeUSD: 23,
            feeGBP: 18,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 2, startTime: "10:00", endTime: "16:00", isActive: true },
          { dayOfWeek: 4, startTime: "10:00", endTime: "16:00", isActive: true },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-style" },
    update: {},
    create: {
      id: "consultant-style",
      name: "Style Consultant",
      title: "Fabric & Style Advisor",
      bio: "Fabric selection, colour theory, and personal style direction.",
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 3,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.STYLING_SESSION,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
            durationMinutes: 30,
            feeNGN: 10000,
            feeUSD: 7,
            feeGBP: 5,
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.DISCOVERY_CALL,
            deliveryMode: ConsultationDeliveryMode.PHONE_CALL,
            durationMinutes: 20,
            feeNGN: 5000,
            feeUSD: 4,
            feeGBP: 3,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isActive: true },
          { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
          { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
        ],
      },
    },
  });

  const seniorOffering = await prisma.consultantOffering.findFirst({
    where: { consultantId: "consultant-senior", sessionType: ConsultationSessionType.BESPOKE_DESIGN },
  });
  const prudentOffering = await prisma.consultantOffering.findFirst({
    where: { consultantId: "consultant-prudent" },
  });
  const styleOffering = await prisma.consultantOffering.findFirst({
    where: { consultantId: "consultant-style" },
  });

  if (amaraUser && seniorOffering) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 10);
    await prisma.consultationBooking.upsert({
      where: { bookingNumber: "CB-26-SEED01" },
      update: {},
      create: {
        bookingNumber: "CB-26-SEED01",
        offeringId: seniorOffering.id,
        consultantId: "consultant-senior",
        userId: amaraUser.id,
        clientName: "Amara",
        clientEmail: "amara@example.com",
        clientPhone: "+2348000000001",
        clientCountry: "NG",
        occasion: "White Wedding",
        description: "Planning a bespoke reception gown with modern lines and traditional accents.",
        referenceImages: [],
        confirmedDate: d,
        confirmedTime: "11:00",
        meetingLink: "https://meet.google.com",
        meetingPlatform: "Google Meet",
        feeNGN: seniorOffering.feeNGN,
        currency: Currency.NGN,
        paymentStatus: PaymentStatus.PAID,
        paymentGateway: PaymentGateway.PAYSTACK,
        paymentRef: "seed-pay-1",
        paidAt: new Date(),
        status: ConsultationStatus.CONFIRMED,
      },
    });
  }

  if (chidinmaUser && prudentOffering) {
    const p1 = new Date();
    p1.setUTCDate(p1.getUTCDate() + 14);
    await prisma.consultationBooking.upsert({
      where: { bookingNumber: "CB-26-SEED02" },
      update: {},
      create: {
        bookingNumber: "CB-26-SEED02",
        offeringId: prudentOffering.id,
        consultantId: "consultant-prudent",
        userId: chidinmaUser.id,
        clientName: "Chidinma",
        clientEmail: "chidinma@example.com",
        clientPhone: "+2348000000002",
        clientCountry: "NG",
        occasion: "Bridal",
        description: "Bridal consultation for traditional and white wedding looks across two days of celebration.",
        referenceImages: [],
        preferredDate1: p1,
        preferredDate2: null,
        preferredDate3: null,
        feeNGN: prudentOffering.feeNGN,
        currency: Currency.NGN,
        paymentStatus: PaymentStatus.PAID,
        paymentGateway: PaymentGateway.PAYSTACK,
        paymentRef: "seed-pay-2",
        paidAt: new Date(),
        status: ConsultationStatus.PENDING_CONFIRMATION,
      },
    });
  }

  if (amaraUser && styleOffering) {
    const d2 = new Date();
    d2.setUTCMonth(d2.getUTCMonth() - 1);
    await prisma.consultationBooking.upsert({
      where: { bookingNumber: "CB-26-SEED03" },
      update: {},
      create: {
        bookingNumber: "CB-26-SEED03",
        offeringId: styleOffering.id,
        consultantId: "consultant-style",
        userId: amaraUser.id,
        clientName: "Amara",
        clientEmail: "amara@example.com",
        clientPhone: "+2348000000001",
        clientCountry: "NG",
        occasion: "Wardrobe Refresh",
        description: "Completed styling session for office and weekend wardrobe refresh.",
        referenceImages: [],
        confirmedDate: d2,
        confirmedTime: "14:00",
        feeNGN: styleOffering.feeNGN,
        currency: Currency.NGN,
        paymentStatus: PaymentStatus.PAID,
        paymentGateway: PaymentGateway.FLUTTERWAVE,
        paymentRef: "seed-pay-3",
        paidAt: d2,
        status: ConsultationStatus.COMPLETED,
        completedAt: d2,
      },
    });
  }

  console.log("  ✅ Consultants and demo consultation bookings ensured.");

  const firstProduct = await prisma.product.findFirst({ select: { id: true } });
  const firstUser = await prisma.user.findFirst({
    where: { email: "folake@example.com" },
    select: { id: true },
  });
  if (firstProduct && firstUser) {
    const existing = await prisma.review.findFirst({
      where: { userId: firstUser.id, productId: firstProduct.id },
    });
    if (!existing) {
      await prisma.review.create({
        data: {
          userId: firstUser.id,
          productId: firstProduct.id,
          rating: 5,
          title: "Stunning",
          body: "Absolutely beautiful craftsmanship — awaiting moderation.",
          isVerified: true,
          isApproved: false,
        },
      });
    }
  }

  const defaultSettings: {
    key: string;
    value: string;
    group: SettingGroup;
    label: string;
    type: SettingType;
    isPublic: boolean;
    sortOrder: number;
  }[] = [
    { key: "store_name", value: "Prudent Gabriel", group: SettingGroup.STORE, label: "Store Name", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "store_tagline", value: "Luxury Nigerian Fashion", group: SettingGroup.STORE, label: "Tagline", type: SettingType.TEXT, isPublic: true, sortOrder: 2 },
    { key: "store_email", value: "hello@prudentgabriel.com", group: SettingGroup.STORE, label: "Contact Email", type: SettingType.TEXT, isPublic: true, sortOrder: 3 },
    { key: "store_phone", value: "+234 000 000 0000", group: SettingGroup.STORE, label: "Phone Number", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "store_address", value: "Lagos, Nigeria", group: SettingGroup.STORE, label: "Address", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 5 },
    { key: "store_currency_default", value: "NGN", group: SettingGroup.STORE, label: "Default Currency", type: SettingType.SELECT, isPublic: true, sortOrder: 6 },
    { key: "free_shipping_lagos", value: "150000", group: SettingGroup.STORE, label: "Free Shipping Threshold — Lagos (₦)", type: SettingType.NUMBER, isPublic: false, sortOrder: 7 },
    { key: "free_shipping_nigeria", value: "250000", group: SettingGroup.STORE, label: "Free Shipping Threshold — Nigeria (₦)", type: SettingType.NUMBER, isPublic: false, sortOrder: 8 },
    { key: "paystack_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Paystack Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "paystack_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Paystack Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 2 },
    { key: "flutterwave_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Flutterwave Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 3 },
    { key: "flutterwave_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Flutterwave Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 4 },
    { key: "stripe_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 5 },
    { key: "stripe_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 6 },
    { key: "stripe_webhook_secret", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Webhook Secret", type: SettingType.PASSWORD, isPublic: false, sortOrder: 7 },
    { key: "monnify_api_key", value: "", group: SettingGroup.PAYMENTS, label: "Monnify API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 8 },
    { key: "monnify_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Monnify Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 9 },
    { key: "monnify_contract_code", value: "", group: SettingGroup.PAYMENTS, label: "Monnify Contract Code", type: SettingType.TEXT, isPublic: false, sortOrder: 10 },
    { key: "monnify_environment", value: "sandbox", group: SettingGroup.PAYMENTS, label: "Monnify Environment", type: SettingType.SELECT, isPublic: false, sortOrder: 11 },
    { key: "email_from_name", value: "Prudent Gabriel", group: SettingGroup.EMAIL, label: "From Name", type: SettingType.TEXT, isPublic: false, sortOrder: 1 },
    { key: "email_from_address", value: "hello@prudentgabriel.com", group: SettingGroup.EMAIL, label: "From Email", type: SettingType.TEXT, isPublic: false, sortOrder: 2 },
    { key: "email_provider", value: "resend", group: SettingGroup.EMAIL, label: "Email Provider", type: SettingType.SELECT, isPublic: false, sortOrder: 3 },
    { key: "brevo_api_key", value: "", group: SettingGroup.EMAIL, label: "Brevo API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 4 },
    { key: "resend_api_key", value: "", group: SettingGroup.EMAIL, label: "Resend API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 5 },
    { key: "smtp_host", value: "", group: SettingGroup.EMAIL, label: "SMTP Host", type: SettingType.TEXT, isPublic: false, sortOrder: 6 },
    { key: "smtp_port", value: "587", group: SettingGroup.EMAIL, label: "SMTP Port", type: SettingType.NUMBER, isPublic: false, sortOrder: 7 },
    { key: "smtp_username", value: "", group: SettingGroup.EMAIL, label: "SMTP Username", type: SettingType.TEXT, isPublic: false, sortOrder: 8 },
    { key: "smtp_password", value: "", group: SettingGroup.EMAIL, label: "SMTP Password", type: SettingType.PASSWORD, isPublic: false, sortOrder: 9 },
    { key: "smtp_use_ssl", value: "true", group: SettingGroup.EMAIL, label: "SMTP Use TLS/SSL", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 10 },
    { key: "admin_notification_email", value: "admin@prudentgabriel.com", group: SettingGroup.EMAIL, label: "Admin Notification Email", type: SettingType.TEXT, isPublic: false, sortOrder: 11 },
    { key: "sms_provider", value: "termii", group: SettingGroup.SMS, label: "SMS Provider", type: SettingType.SELECT, isPublic: false, sortOrder: 1 },
    { key: "sms_api_key", value: "", group: SettingGroup.SMS, label: "SMS API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 2 },
    { key: "sms_sender_id", value: "PrudentGab", group: SettingGroup.SMS, label: "SMS Sender ID", type: SettingType.TEXT, isPublic: false, sortOrder: 3 },
    { key: "sms_order_confirmed", value: "true", group: SettingGroup.SMS, label: "Send SMS on Order Confirmed", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 4 },
    { key: "sms_order_shipped", value: "true", group: SettingGroup.SMS, label: "Send SMS on Order Shipped", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 5 },
    { key: "sms_consultation_confirmed", value: "true", group: SettingGroup.SMS, label: "Send SMS on Consultation Confirmed", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 6 },
    { key: "img_hero", value: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600", group: SettingGroup.APPEARANCE, label: "Homepage Hero Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 1 },
    { key: "img_bride_hero", value: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=1600", group: SettingGroup.APPEARANCE, label: "Prudential Bride Hero Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 2 },
    { key: "img_bride_portrait", value: "https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800", group: SettingGroup.APPEARANCE, label: "Prudential Bride Portrait", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
    { key: "img_bespoke", value: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800", group: SettingGroup.APPEARANCE, label: "Bespoke Section Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 4 },
    { key: "img_atelier_wide", value: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200", group: SettingGroup.APPEARANCE, label: "Atelier Story Wide Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 5 },
    { key: "img_atelier_portrait", value: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800", group: SettingGroup.APPEARANCE, label: "Atelier Story Portrait Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 6 },
    { key: "img_consultation_hero", value: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600", group: SettingGroup.APPEARANCE, label: "Consultation Page Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 7 },
    { key: "img_bespoke_hero", value: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600", group: SettingGroup.APPEARANCE, label: "Bespoke Page Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 8 },
    { key: "img_collection_bridal", value: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Bridal", type: SettingType.IMAGE, isPublic: true, sortOrder: 9 },
    { key: "img_collection_evening", value: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Evening", type: SettingType.IMAGE, isPublic: true, sortOrder: 10 },
    { key: "img_collection_formal", value: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Formal", type: SettingType.IMAGE, isPublic: true, sortOrder: 11 },
    { key: "img_collection_rtw", value: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — RTW", type: SettingType.IMAGE, isPublic: true, sortOrder: 12 },
    { key: "img_our_story_hero", value: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400", group: SettingGroup.APPEARANCE, label: "Our Story Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 13 },
    { key: "favicon_url", value: "/images/logo.svg", group: SettingGroup.APPEARANCE, label: "Favicon URL", type: SettingType.IMAGE, isPublic: true, sortOrder: 14 },
    { key: "social_instagram", value: "@prudent_gabriel", group: SettingGroup.SOCIAL, label: "Instagram Handle", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "social_tiktok", value: "@prudentgabriel", group: SettingGroup.SOCIAL, label: "TikTok Handle", type: SettingType.TEXT, isPublic: true, sortOrder: 2 },
    { key: "social_facebook", value: "prudentgabriel", group: SettingGroup.SOCIAL, label: "Facebook Page", type: SettingType.TEXT, isPublic: true, sortOrder: 3 },
    { key: "social_youtube", value: "", group: SettingGroup.SOCIAL, label: "YouTube Channel", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "social_whatsapp", value: "", group: SettingGroup.SOCIAL, label: "WhatsApp Business Number", type: SettingType.TEXT, isPublic: true, sortOrder: 5 },
    { key: "points_per_100_naira", value: "1", group: SettingGroup.LOYALTY, label: "Points per ₦100 spent", type: SettingType.NUMBER, isPublic: false, sortOrder: 1 },
    { key: "points_referral_referrer", value: "250", group: SettingGroup.LOYALTY, label: "Points for referrer on signup", type: SettingType.NUMBER, isPublic: false, sortOrder: 2 },
    { key: "points_referral_new_user", value: "500", group: SettingGroup.LOYALTY, label: "Points for new referred user", type: SettingType.NUMBER, isPublic: false, sortOrder: 3 },
    { key: "points_review", value: "50", group: SettingGroup.LOYALTY, label: "Points for leaving a review", type: SettingType.NUMBER, isPublic: false, sortOrder: 4 },
    { key: "seo_title_template", value: "%s | Prudent Gabriel", group: SettingGroup.SEO, label: "Page Title Template (%s = page name)", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "seo_default_description", value: "Luxury Nigerian fashion — bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Ships worldwide.", group: SettingGroup.SEO, label: "Default Meta Description", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 2 },
    { key: "seo_og_image", value: "", group: SettingGroup.SEO, label: "Default OG Share Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
    { key: "notify_new_order", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new order", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 1 },
    { key: "notify_new_bespoke", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new bespoke request", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 2 },
    { key: "notify_new_consultation", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new consultation booking", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 3 },
    { key: "notify_low_stock", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email when variant stock ≤ lowStockAt", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 4 },
    { key: "slack_webhook_url", value: "", group: SettingGroup.NOTIFICATIONS, label: "Slack Webhook URL (for alerts)", type: SettingType.PASSWORD, isPublic: false, sortOrder: 5 },
  ];

  for (const setting of defaultSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  const emailTemplates: { key: string; label: string; sortOrder: number }[] = [
    { key: "email_tpl_welcome", label: "Welcome Email", sortOrder: 100 },
    { key: "email_tpl_order_confirmation", label: "Order Confirmation", sortOrder: 101 },
    { key: "email_tpl_order_shipped", label: "Order Shipped", sortOrder: 102 },
    { key: "email_tpl_bespoke_confirmation", label: "Bespoke Confirmation", sortOrder: 103 },
    { key: "email_tpl_password_reset", label: "Password Reset", sortOrder: 104 },
    { key: "email_tpl_referral_success", label: "Referral Success", sortOrder: 105 },
    { key: "email_tpl_back_in_stock", label: "Back In Stock", sortOrder: 106 },
    { key: "email_tpl_consultation_pending", label: "Consultation Pending", sortOrder: 107 },
    { key: "email_tpl_consultation_confirmed", label: "Consultation Confirmed", sortOrder: 108 },
    { key: "email_tpl_consultation_cancelled", label: "Consultation Cancelled", sortOrder: 109 },
  ];
  const tplDefault = JSON.stringify({ subject: "", body: "" });
  for (const t of emailTemplates) {
    await prisma.siteSetting.upsert({
      where: { key: t.key },
      update: {},
      create: {
        key: t.key,
        value: tplDefault,
        group: SettingGroup.EMAIL,
        label: t.label,
        type: SettingType.JSON,
        isPublic: false,
        sortOrder: t.sortOrder,
      },
    });
  }

  console.log("  ✅ Site settings seeded (upsert, existing values preserved).");

  const [productCount, orderCount, bespokeCount, couponCount] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.bespokeRequest.count(),
    prisma.coupon.count(),
  ]);
  console.log(
    `Seed complete: ${productCount} products, ${orderCount} orders, ${bespokeCount} bespoke requests, ${couponCount} coupons.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
