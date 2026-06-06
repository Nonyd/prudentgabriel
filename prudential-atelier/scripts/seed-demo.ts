/**
 * Demo seed — luxury Nigerian atelier data for client presentations.
 * Safe to re-run: upserts + createMany(skipDuplicates) + targeted deletes for child records.
 */
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  PrismaClient,
  Role,
  ProductCategory,
  ProductType,
  LoyaltyTier,
  StaffDepartment,
  EmploymentType,
  BespokeStage,
  OrderStatus,
  InvoiceStatus,
  QuoteStatus,
  BlogStatus,
  ConsultationStatus,
  ConsultationSessionType,
  ConsultationDeliveryMode,
  PaymentStatus,
  PaymentGateway,
  Currency,
  PointsType,
} from "@prisma/client";
import { STAGE_ORDER } from "../src/lib/bespoke-stages";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const DEMO_CLIENT_PASSWORD = process.env.DEMO_CLIENT_PASSWORD || "Demo@2024!";
const DEMO_STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || "Staff@2024!";
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.trim() || "nony@sonshubmedia.com";

const IMG = {
  bridal: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
  evening: "https://images.unsplash.com/photo-1566174053879-435285eff2e8?w=800",
  formal: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
  casual: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800",
  kiddies: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800",
  accessories: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function atTime(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dateOnly(base: Date): Date {
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lineItem(
  description: string,
  quantity: number,
  unitPrice: number,
): { id: string; description: string; quantity: number; unitPrice: number; amount: number } {
  return {
    id: nanoid(),
    description,
    quantity,
    unitPrice,
    amount: quantity * unitPrice,
  };
}

type DemoProduct = {
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  type: ProductType;
  priceNGN: number;
  tags: string[];
  isFeatured?: boolean;
  isNewArrival?: boolean;
  orderCount: number;
  sizes: string[];
  image: string;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    slug: "the-adaeze-gown",
    name: "The Adaeze Gown",
    description:
      "A floor-length evening gown in hand-woven Aso-Oke with structured bodice and fluid skirt. Designed for the woman who commands every room she enters.",
    category: ProductCategory.EVENING_WEAR,
    type: ProductType.RTW,
    priceNGN: 485_000,
    tags: ["bestseller", "featured", "Evening"],
    isFeatured: true,
    orderCount: 28,
    sizes: ["XS", "S", "M", "L", "XL"],
    image: IMG.evening,
  },
  {
    slug: "ife-bias-slip-dress",
    name: "Ife Bias Slip Dress",
    description:
      "Bias-cut silk slip with subtle sheen — effortless Lagos evening elegance.",
    category: ProductCategory.CASUAL,
    type: ProductType.RTW,
    priceNGN: 268_000,
    tags: ["new arrival", "Casual"],
    isNewArrival: true,
    orderCount: 12,
    sizes: ["XS", "S", "M", "L"],
    image: IMG.casual,
  },
  {
    slug: "lumi-tailored-suit",
    name: "Lumi Tailored Suit",
    description:
      "Double-breasted tailored suit in Italian wool blend with hand-finished lapels.",
    category: ProductCategory.FORMAL,
    type: ProductType.RTW,
    priceNGN: 392_000,
    tags: ["featured", "Corporate"],
    isFeatured: true,
    orderCount: 19,
    sizes: ["S", "M", "L", "XL"],
    image: IMG.formal,
  },
  {
    slug: "ember-silk-wrap",
    name: "Ember Silk Wrap",
    description: "Fluid silk wrap dress with adjustable tie — one silhouette, many moods.",
    category: ProductCategory.EVENING_WEAR,
    type: ProductType.RTW,
    priceNGN: 178_000,
    tags: ["Evening"],
    orderCount: 8,
    sizes: ["One Size", "S/M", "L/XL"],
    image: IMG.evening,
  },
  {
    slug: "nneka-aso-ebi-set",
    name: "Nneka Aso-Ebi Set",
    description:
      "Coordinated Aso-Oke set with structured blouse and full wrapper skirt for celebration dressing.",
    category: ProductCategory.FORMAL,
    type: ProductType.RTW,
    priceNGN: 215_000,
    tags: ["bestseller", "Traditional"],
    isFeatured: true,
    orderCount: 34,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: IMG.formal,
  },
  {
    slug: "the-zahra-bridal-gown",
    name: "The Zahra Bridal Gown",
    description:
      "Couture bridal commission with cathedral train and hand-applied crystal embroidery.",
    category: ProductCategory.BRIDAL,
    type: ProductType.BESPOKE,
    priceNGN: 1_250_000,
    tags: ["featured", "bestseller", "Bridal"],
    isFeatured: true,
    orderCount: 15,
    sizes: ["Custom only (bespoke)"],
    image: IMG.bridal,
  },
  {
    slug: "celeste-bridal-cape-set",
    name: "Celeste Bridal Cape Set",
    description: "Bridal gown with detachable beaded cape for ceremony and reception.",
    category: ProductCategory.BRIDAL,
    type: ProductType.BESPOKE,
    priceNGN: 1_680_000,
    tags: ["Bridal"],
    orderCount: 6,
    sizes: ["Custom only (bespoke)"],
    image: IMG.bridal,
  },
  {
    slug: "amara-reception-dress",
    name: "Amara Reception Dress",
    description: "Second-look reception dress in silk mikado with sculpted neckline.",
    category: ProductCategory.BRIDAL,
    type: ProductType.BESPOKE,
    priceNGN: 890_000,
    tags: ["Bridal"],
    orderCount: 11,
    sizes: ["Custom only (bespoke)"],
    image: IMG.bridal,
  },
  {
    slug: "kito-junior-tuxedo",
    name: "Kito Junior Tuxedo",
    description: "Miniature tuxedo set for young gentlemen at weddings and galas.",
    category: ProductCategory.KIDDIES,
    type: ProductType.RTW,
    priceNGN: 96_000,
    tags: ["Kiddies"],
    orderCount: 14,
    sizes: ["Age 2-4", "Age 4-6", "Age 6-8", "Age 8-10"],
    image: IMG.kiddies,
  },
  {
    slug: "zara-flower-girl-set",
    name: "Zara Flower Girl Set",
    description: "Delicate flower girl ensemble with soft tulle and satin sash.",
    category: ProductCategory.KIDDIES,
    type: ProductType.RTW,
    priceNGN: 78_000,
    tags: ["Kiddies", "Bridal"],
    orderCount: 9,
    sizes: ["Age 2-4", "Age 4-6", "Age 6-8"],
    image: IMG.kiddies,
  },
  {
    slug: "adire-head-wrap",
    name: "Adire Head Wrap",
    description: "Hand-dyed Adire gele in rich indigo — the finishing touch for any look.",
    category: ProductCategory.ACCESSORIES,
    type: ProductType.RTW,
    priceNGN: 45_000,
    tags: ["Accessories"],
    orderCount: 22,
    sizes: ["One Size"],
    image: IMG.accessories,
  },
  {
    slug: "beaded-evening-clutch",
    name: "Beaded Evening Clutch",
    description: "Crystal-beaded clutch with silk lining — made in our Lagos atelier.",
    category: ProductCategory.ACCESSORIES,
    type: ProductType.RTW,
    priceNGN: 67_000,
    tags: ["Accessories", "Evening"],
    orderCount: 17,
    sizes: ["One Size"],
    image: IMG.accessories,
  },
];

const DEMO_CLIENTS = [
  {
    email: "amaka.nwosu@gmail.com",
    name: "Amaka Nwosu",
    phone: "+234 803 456 7890",
    tier: LoyaltyTier.GOLD,
    loyaltyPoints: 6240,
    totalSpend: 1_850_000,
    pointsBalance: 6240,
    measurements: { bust: 38, waist: 30, hips: 42, dressLength: 62, shoulderWidth: 15, sleeveLength: 24 },
    events: [
      { label: "Birthday", month: 0, day: 5 },
      { label: "Wedding Anniversary", month: 7, day: 12 },
    ],
    note: null as string | null,
  },
  {
    email: "chisom.eze@yahoo.com",
    name: "Chisom Eze",
    phone: "+234 805 234 5678",
    tier: LoyaltyTier.PLATINUM,
    loyaltyPoints: 12_500,
    totalSpend: 4_200_000,
    pointsBalance: 12_500,
    measurements: { bust: 40, waist: 32, hips: 44, dressLength: 60 },
    events: [] as { label: string; month: number; day: number }[],
    note: "VIP client — prefers silk and Aso-Oke. Always book with Mrs. Prudent directly.",
  },
  {
    email: "fatima.aliyu@gmail.com",
    name: "Fatima Aliyu",
    phone: "+234 708 123 4567",
    tier: LoyaltyTier.SILVER,
    loyaltyPoints: 3100,
    totalSpend: 680_000,
    pointsBalance: 3100,
    measurements: { bust: 36, waist: 28, hips: 40, dressLength: 64 },
    events: [],
    note: null,
  },
  {
    email: "blessing.obi@hotmail.com",
    name: "Blessing Obi",
    phone: "+234 812 567 8901",
    tier: LoyaltyTier.BRONZE,
    loyaltyPoints: 850,
    totalSpend: 185_000,
    pointsBalance: 850,
    measurements: null,
    events: [],
    note: null,
  },
  {
    email: "sandra.dike@gmail.com",
    name: "Sandra Dike",
    phone: "+234 703 890 1234",
    tier: LoyaltyTier.GOLD,
    loyaltyPoints: 5800,
    totalSpend: 1_340_000,
    pointsBalance: 5800,
    measurements: null,
    events: [],
    note: "Prefers Corset style. Event: Chief's wife investiture ceremony.",
  },
  {
    email: "yetunde.adeyemi@gmail.com",
    name: "Yetunde Adeyemi",
    phone: "+234 806 345 6789",
    tier: LoyaltyTier.BRONZE,
    loyaltyPoints: 420,
    totalSpend: 240_000,
    pointsBalance: 420,
    measurements: null,
    events: [],
    note: null,
  },
  {
    email: "ngozi.peters@gmail.com",
    name: "Ngozi Peters",
    phone: "+234 704 678 9012",
    tier: LoyaltyTier.SILVER,
    loyaltyPoints: 2400,
    totalSpend: 520_000,
    pointsBalance: 2400,
    measurements: null,
    events: [],
    note: null,
  },
  {
    email: "bola.adeyemi@gmail.com",
    name: "Bola Adeyemi",
    phone: "+234 809 012 3456",
    tier: LoyaltyTier.PLATINUM,
    loyaltyPoints: 18_200,
    totalSpend: 6_800_000,
    pointsBalance: 18_200,
    measurements: null,
    events: [],
    note: "Our most loyal client. Always send personal note with delivery.",
  },
];

const DEMO_STAFF = [
  {
    email: "tunde.kareem@prudentgabriel.com",
    name: "Tunde Kareem",
    jobTitle: "Senior Tailor",
    department: StaffDepartment.TAILOR,
    skillTags: ["bridal", "evening wear", "pattern cutting"],
    employmentType: EmploymentType.EMPLOYEE,
    attendancePattern: "regular" as const,
  },
  {
    email: "ngozi.kalu@prudentgabriel.com",
    name: "Ngozi Kalu",
    jobTitle: "Head Beader",
    department: StaffDepartment.BEADER,
    skillTags: ["bridal beading", "hand embroidery", "crystal work"],
    employmentType: EmploymentType.EMPLOYEE,
    attendancePattern: "regular" as const,
  },
  {
    email: "emeka.obi@prudentgabriel.com",
    name: "Emeka Obi",
    jobTitle: "Tailor",
    department: StaffDepartment.TAILOR,
    skillTags: ["tailoring", "alterations"],
    employmentType: EmploymentType.EMPLOYEE,
    attendancePattern: "late" as const,
  },
  {
    email: "amina.ibrahim@prudentgabriel.com",
    name: "Amina Ibrahim",
    jobTitle: "Fashion Designer",
    department: StaffDepartment.DESIGNER,
    skillTags: ["sketching", "concept development", "fabric selection"],
    employmentType: EmploymentType.EMPLOYEE,
    attendancePattern: "regular" as const,
  },
  {
    email: "grace.eze@prudentgabriel.com",
    name: "Grace Eze",
    jobTitle: "Junior Beader",
    department: StaffDepartment.BEADER,
    skillTags: ["beading", "finishing"],
    employmentType: EmploymentType.EMPLOYEE,
    attendancePattern: "regular" as const,
  },
  {
    email: "halima.yusuf@prudentgabriel.com",
    name: "Halima Yusuf",
    jobTitle: "Pattern Cutter",
    department: StaffDepartment.GENERAL,
    skillTags: ["pattern cutting", "grading"],
    employmentType: EmploymentType.FREELANCER,
    attendancePattern: "freelance" as const,
  },
];

const STAGE_NOTES: Partial<Record<BespokeStage, string>> = {
  CONSULTATION_BOOKING:
    "Consultation confirmed with client. Occasion, palette, and delivery window captured.",
  CONSULTATION_SESSION:
    "In-depth session completed. Client preferences documented with reference imagery.",
  INVOICE_ISSUANCE: "Detailed quotation issued and shared for client review.",
  PAYMENT_CONFIRMATION: "Deposit received and verified. Production timeline activated.",
  SKETCHING_CONCEPT:
    "Initial sketches presented. Silhouette and neckline direction approved.",
  FABRIC_SOURCING:
    "Premium fabrics sourced from trusted Lagos and Kano suppliers.",
  DESIGN_APPROVAL:
    "Final design, fabric, and embellishment selections signed off by client.",
  TAILORING: "Construction underway in the tailoring atelier.",
  FIRST_FITTING: "First fitting completed. Structural adjustments noted.",
  ALTERATIONS: "Alterations in progress following fitting feedback.",
  BEADING_FINISHING: "Hand beading and finishing details applied.",
  FINAL_FITTING: "Final fitting confirms perfect fit and drape.",
  DELIVERY: "Garment delivered to client. Care instructions provided.",
};

const ORDER_2847_STAGE_NOTES: Partial<Record<BespokeStage, string>> = {
  CONSULTATION_BOOKING:
    "Consultation confirmed with Mrs. Amaka. She wants a full-length Asoebi in burgundy Aso-Oke.",
  CONSULTATION_SESSION:
    "In-person session at the atelier. Wedding party palette and gele styling discussed.",
  INVOICE_ISSUANCE: "Quotation INV-2847 issued. 50% deposit schedule agreed.",
  PAYMENT_CONFIRMATION: "₦325,000 deposit received via bank transfer.",
  SKETCHING_CONCEPT:
    "Mood board approved — regal burgundy with gold accents.",
  FABRIC_SOURCING: "Premium Aso-Oke sourced from Kano. Lining and interfacing selected.",
  DESIGN_APPROVAL:
    "Initial sketches approved. Corset bodice with layered skirt.",
};

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function seedProducts() {
  console.log("\n👗 Seeding demo products…");
  const productIds: Record<string, string> = {};

  for (const p of DEMO_PRODUCTS) {
    const isBestSeller = p.orderCount >= 10;
    const variantSizes = p.sizes.slice(0, randInt(2, Math.min(3, p.sizes.length)));
    const selectedSizes =
      variantSizes.length >= 2 ? variantSizes : p.sizes.slice(0, Math.min(3, p.sizes.length));

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        category: p.category,
        type: p.type,
        priceNGN: p.priceNGN,
        basePriceNGN: p.priceNGN,
        isPublished: true,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        tags: p.tags,
        orderCount: p.orderCount,
        isBestSeller,
        inStock: true,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        details: `<p>${p.description}</p>`,
        category: p.category,
        type: p.type,
        priceNGN: p.priceNGN,
        basePriceNGN: p.priceNGN,
        isPublished: true,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        isBespokeAvail: p.type === ProductType.BESPOKE,
        tags: p.tags,
        orderCount: p.orderCount,
        isBestSeller,
        inStock: true,
        images: {
          create: {
            url: p.image,
            alt: p.name,
            isPrimary: true,
            sortOrder: 0,
          },
        },
      },
    });

    productIds[p.slug] = product.id;

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: p.image,
        alt: p.name,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.createMany({
      data: selectedSizes.map((size, i) => ({
        productId: product.id,
        sku: `DEMO-${p.slug.toUpperCase().replace(/-/g, "").slice(0, 12)}-${size.replace(/\s+/g, "")}`,
        size,
        priceNGN: p.priceNGN,
        stock: randInt(2, 15),
        sortOrder: i,
      })),
    });
  }

  console.log(`  ✅ ${DEMO_PRODUCTS.length} products`);
  return productIds;
}

async function seedClients(clientPasswordHash: string) {
  console.log("\n👤 Seeding demo clients…");
  const clientMap: Record<string, { userId: string; profileId: string }> = {};
  const year = new Date().getFullYear();

  for (const c of DEMO_CLIENTS) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {
        name: c.name,
        phone: c.phone,
        role: Role.CUSTOMER,
        pointsBalance: c.pointsBalance,
        isActive: true,
      },
      create: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        password: clientPasswordHash,
        role: Role.CUSTOMER,
        pointsBalance: c.pointsBalance,
        isActive: true,
      },
    });

    const profile = await prisma.clientProfile.upsert({
      where: { userId: user.id },
      update: {
        loyaltyTier: c.tier,
        loyaltyPoints: c.loyaltyPoints,
        totalSpend: c.totalSpend,
      },
      create: {
        userId: user.id,
        loyaltyTier: c.tier,
        loyaltyPoints: c.loyaltyPoints,
        totalSpend: c.totalSpend,
        preferredColors: ["burgundy", "gold", "ivory"],
        occasions: ["wedding", "gala"],
      },
    });

    if (c.measurements) {
      await prisma.measurement.upsert({
        where: { clientId: profile.id },
        update: { ...c.measurements, unit: "inches" },
        create: {
          clientId: profile.id,
          ...c.measurements,
          unit: "inches",
        },
      });
    }

    await prisma.eventDate.deleteMany({ where: { clientId: profile.id } });
    if (c.events.length) {
      await prisma.eventDate.createMany({
        data: c.events.map((e) => ({
          clientId: profile.id,
          label: e.label,
          date: new Date(year, e.month, e.day),
        })),
      });
    }

    if (c.note) {
      const existingNote = await prisma.clientNote.findFirst({
        where: { clientId: profile.id, note: c.note },
      });
      if (!existingNote) {
        await prisma.clientNote.create({
          data: {
            clientId: profile.id,
            note: c.note,
            addedBy: "demo-seed",
            addedByName: "Demo Seed",
          },
        });
      }
    }

    clientMap[c.email] = { userId: user.id, profileId: profile.id };
  }

  console.log(`  ✅ ${DEMO_CLIENTS.length} clients`);
  return clientMap;
}

async function seedStaff(staffPasswordHash: string) {
  console.log("\n🧵 Seeding demo staff…");
  const staffMap: Record<string, { userId: string; profileId: string }> = {};
  const today = new Date();

  for (const s of DEMO_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        role: Role.STAFF,
        isStaff: true,
        jobTitle: s.jobTitle,
        department: s.department,
        isActive: true,
      },
      create: {
        name: s.name,
        email: s.email,
        password: staffPasswordHash,
        role: Role.STAFF,
        isStaff: true,
        jobTitle: s.jobTitle,
        department: s.department,
        isActive: true,
      },
    });

    const profile = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        department: s.department,
        employmentType: s.employmentType,
        skillTags: s.skillTags,
        isActive: true,
      },
      create: {
        userId: user.id,
        department: s.department,
        employmentType: s.employmentType,
        skillTags: s.skillTags,
        isActive: true,
        ordersCompleted: randInt(12, 48),
        attendanceScore: randInt(85, 98),
      },
    });

    staffMap[s.email] = { userId: user.id, profileId: profile.id };

    await prisma.attendanceLog.deleteMany({
      where: {
        staffId: profile.id,
        date: { gte: addDays(today, -14) },
      },
    });

    const logs: {
      staffId: string;
      date: Date;
      clockIn: Date;
      clockOut: Date;
      totalHours: number;
      taskNote?: string;
    }[] = [];

    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const day = dateOnly(addDays(today, -dayOffset));
      const dow = day.getDay();

      if (s.attendancePattern === "freelance") {
        if (dayOffset % 2 !== 0 && dayOffset % 3 !== 0) continue;
        if (logs.length >= 6) continue;
      }

      if (s.attendancePattern === "late") {
        const absentDays = [3, 8];
        if (absentDays.includes(dayOffset)) continue;
        const lateDays = [1, 5, 11];
        const isLate = lateDays.includes(dayOffset);
        const clockInHour = isLate ? randInt(9, 10) : randInt(7, 8);
        const clockInMin = isLate ? randInt(15, 45) : randInt(45, 59);
        const clockIn = atTime(day, clockInHour, clockInMin);
        const clockOut = atTime(day, randInt(17, 18), randInt(30, 59));
        const hours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000;
        logs.push({
          staffId: profile.id,
          date: day,
          clockIn,
          clockOut,
          totalHours: Math.round(hours * 10) / 10,
          taskNote: isLate ? "Late arrival — traffic on Third Mainland Bridge" : undefined,
        });
        continue;
      }

      if (dow === 0) continue;

      const clockIn = atTime(day, randInt(7, 8), randInt(45, 59));
      const clockOut = atTime(day, randInt(17, 18), randInt(30, 59));
      const hours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000;
      if (hours < 6 || hours > 8.5) continue;

      logs.push({
        staffId: profile.id,
        date: day,
        clockIn,
        clockOut,
        totalHours: Math.round(hours * 10) / 10,
      });
    }

    if (logs.length) {
      await prisma.attendanceLog.createMany({ data: logs });
    }
  }

  console.log(`  ✅ ${DEMO_STAFF.length} staff with attendance logs`);
  return staffMap;
}

async function upsertBespokeOrder(params: {
  orderRef: string;
  clientEmail: string;
  clientMap: Record<string, { userId: string; profileId: string }>;
  outfitDescription: string;
  occasionType: string;
  eventLocation?: string;
  deliveryDate: Date;
  currentStage: BespokeStage;
  totalAmount: number;
  amountPaid: number;
  status: OrderStatus;
  notes?: string;
  tailorEmail?: string;
  staffMap: Record<string, { userId: string; profileId: string }>;
  customStageNotes?: Partial<Record<BespokeStage, string>>;
  completedThroughStage?: BespokeStage;
}) {
  const client = DEMO_CLIENTS.find((c) => c.email === params.clientEmail)!;
  const profile = params.clientMap[params.clientEmail];

  const profileConnect = profile?.profileId
    ? { clientProfile: { connect: { id: profile.profileId } } }
    : {};

  const order = await prisma.bespokeOrder.upsert({
    where: { orderRef: params.orderRef },
    update: {
      ...profileConnect,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      outfitDescription: params.outfitDescription,
      occasionType: params.occasionType,
      eventLocation: params.eventLocation,
      deliveryDate: params.deliveryDate,
      currentStage: params.currentStage,
      totalAmount: params.totalAmount,
      amountPaid: params.amountPaid,
      balance: params.totalAmount - params.amountPaid,
      status: params.status,
      notes: params.notes ?? null,
    },
    create: {
      orderRef: params.orderRef,
      ...profileConnect,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      outfitDescription: params.outfitDescription,
      occasionType: params.occasionType,
      eventLocation: params.eventLocation,
      deliveryDate: params.deliveryDate,
      currentStage: params.currentStage,
      totalAmount: params.totalAmount,
      amountPaid: params.amountPaid,
      balance: params.totalAmount - params.amountPaid,
      status: params.status,
      notes: params.notes ?? null,
    },
  });

  await prisma.stageUpdate.deleteMany({ where: { orderId: order.id } });
  await prisma.orderAssignment.deleteMany({ where: { orderId: order.id } });

  const currentIdx = STAGE_ORDER.indexOf(params.currentStage);
  const completedIdx =
    params.completedThroughStage != null
      ? STAGE_ORDER.indexOf(params.completedThroughStage)
      : params.status === OrderStatus.DELIVERED && params.currentStage === BespokeStage.DELIVERY
        ? currentIdx
        : Math.max(0, currentIdx - 1);

  const stageRows: {
    orderId: string;
    stage: BespokeStage;
    notes: string;
    completedBy: string;
    completedByName: string;
    completedAt: Date;
    images: string[];
    videos: string[];
  }[] = [];

  for (let i = 0; i <= completedIdx; i++) {
    const stage = STAGE_ORDER[i]!;
    const note =
      params.customStageNotes?.[stage] ??
      STAGE_NOTES[stage] ??
      `${STAGE_ORDER[i]} completed for ${params.orderRef}.`;
    stageRows.push({
      orderId: order.id,
      stage,
      notes: note,
      completedBy: "demo-seed",
      completedByName: "Prudential Atelier",
      completedAt: addDays(new Date(), -(completedIdx - i + 3)),
      images: [],
      videos: [],
    });
  }

  if (stageRows.length) {
    await prisma.stageUpdate.createMany({ data: stageRows });
  }

  if (params.tailorEmail && params.staffMap[params.tailorEmail]) {
    await prisma.orderAssignment.create({
      data: {
        orderId: order.id,
        staffProfileId: params.staffMap[params.tailorEmail].profileId,
        role: "Lead Tailor",
      },
    });
  }

  return order;
}

async function seedBespokeOrders(
  clientMap: Record<string, { userId: string; profileId: string }>,
  staffMap: Record<string, { userId: string; profileId: string }>,
) {
  console.log("\n📐 Seeding demo bespoke orders…");
  const now = new Date();

  await upsertBespokeOrder({
    orderRef: "ORD-2847",
    clientEmail: "amaka.nwosu@gmail.com",
    clientMap,
    staffMap,
    outfitDescription: "Custom Asoebi Gown",
    occasionType: "Wedding",
    eventLocation: "Eko Hotel, Lagos",
    deliveryDate: addDays(now, 45),
    currentStage: BespokeStage.TAILORING,
    totalAmount: 650_000,
    amountPaid: 325_000,
    status: OrderStatus.PROCESSING,
    tailorEmail: "tunde.kareem@prudentgabriel.com",
    customStageNotes: ORDER_2847_STAGE_NOTES,
  });

  await upsertBespokeOrder({
    orderRef: "ORD-2848",
    clientEmail: "chisom.eze@yahoo.com",
    clientMap,
    staffMap,
    outfitDescription: "Bridal Gown + Reception Dress",
    occasionType: "Wedding",
    deliveryDate: addDays(now, 8),
    currentStage: BespokeStage.BEADING_FINISHING,
    totalAmount: 1_850_000,
    amountPaid: 1_850_000,
    status: OrderStatus.PROCESSING,
    notes: "URGENT — delivery in 8 days. Priority beading queue.",
    tailorEmail: "tunde.kareem@prudentgabriel.com",
    completedThroughStage: BespokeStage.ALTERATIONS,
  });

  await upsertBespokeOrder({
    orderRef: "ORD-2849",
    clientEmail: "fatima.aliyu@gmail.com",
    clientMap,
    staffMap,
    outfitDescription: "Nikkai Ceremony Outfit",
    occasionType: "Nikkai",
    deliveryDate: addDays(now, 60),
    currentStage: BespokeStage.FABRIC_SOURCING,
    totalAmount: 380_000,
    amountPaid: 190_000,
    status: OrderStatus.CONFIRMED,
    completedThroughStage: BespokeStage.SKETCHING_CONCEPT,
  });

  await upsertBespokeOrder({
    orderRef: "ORD-2850",
    clientEmail: "blessing.obi@hotmail.com",
    clientMap,
    staffMap,
    outfitDescription: "Corporate Capsule Wardrobe (3 pieces)",
    occasionType: "Work/Corporate",
    deliveryDate: addDays(now, 30),
    currentStage: BespokeStage.DESIGN_APPROVAL,
    totalAmount: 520_000,
    amountPaid: 260_000,
    status: OrderStatus.CONFIRMED,
    completedThroughStage: BespokeStage.FABRIC_SOURCING,
  });

  await upsertBespokeOrder({
    orderRef: "ORD-2851",
    clientEmail: "sandra.dike@gmail.com",
    clientMap,
    staffMap,
    outfitDescription: "Chieftaincy Ceremony Wrapper Set",
    occasionType: "Traditional Ceremony",
    deliveryDate: addDays(now, -14),
    currentStage: BespokeStage.DELIVERY,
    totalAmount: 420_000,
    amountPaid: 420_000,
    status: OrderStatus.DELIVERED,
    tailorEmail: "tunde.kareem@prudentgabriel.com",
    completedThroughStage: BespokeStage.DELIVERY,
  });

  console.log("  ✅ 5 bespoke orders with stage history");
}

async function seedConsultations(
  clientMap: Record<string, { userId: string; profileId: string }>,
) {
  console.log("\n📅 Seeding demo consultations…");

  const virtualOffering = await prisma.consultantOffering.findFirst({
    where: {
      deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
      isActive: true,
    },
  });
  const prudentVirtual = await prisma.consultantOffering.findFirst({
    where: {
      deliveryMode: ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT,
      isActive: true,
    },
  });
  const atelierOffering = await prisma.consultantOffering.findFirst({
    where: {
      deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT,
      isActive: true,
    },
  });

  if (!virtualOffering || !atelierOffering) {
    console.log("  ⚠ Skipping consultations — run prisma/seed.ts first for consultants.");
    return;
  }

  const tomorrow = addDays(new Date(), 1);

  const bookings = [
    {
      bookingNumber: "DEMO-CB-001",
      offering: prudentVirtual ?? virtualOffering,
      consultantId: prudentVirtual?.consultantId ?? virtualOffering.consultantId,
      userId: null as string | null,
      clientName: "Kemi Adesanya",
      clientEmail: "kemi.adesanya@gmail.com",
      clientPhone: "+234 801 234 5678",
      occasion: "30th birthday celebration outfit",
      description:
        "Seeking a statement evening look for a milestone birthday celebration in Lagos.",
      confirmedDate: atTime(tomorrow, 10, 0),
      confirmedTime: "10:00",
      meetingLink: "https://zoom.us/j/demo-prudential-consult",
      meetingPlatform: "Zoom",
      feeNGN: 40_000,
      status: ConsultationStatus.CONFIRMED,
      completedAt: null as Date | null,
    },
    {
      bookingNumber: "DEMO-CB-002",
      offering: atelierOffering,
      consultantId: atelierOffering.consultantId,
      userId: clientMap["ngozi.peters@gmail.com"]?.userId ?? null,
      clientName: "Ngozi Peters",
      clientEmail: "ngozi.peters@gmail.com",
      clientPhone: "+234 704 678 9012",
      occasion: "Bridal consultation for December wedding",
      description:
        "Full bridal consultation — traditional and white wedding looks for December ceremony.",
      confirmedDate: atTime(tomorrow, 14, 0),
      confirmedTime: "14:00",
      atelierAddress: "Prudential Atelier, Victoria Island, Lagos",
      feeNGN: 150_000,
      status: ConsultationStatus.CONFIRMED,
      completedAt: null,
    },
    {
      bookingNumber: "DEMO-CB-003",
      offering: virtualOffering,
      consultantId: virtualOffering.consultantId,
      userId: clientMap["bola.adeyemi@gmail.com"]?.userId ?? null,
      clientName: "Bola Adeyemi",
      clientEmail: "bola.adeyemi@gmail.com",
      clientPhone: "+234 809 012 3456",
      occasion: "New year gala outfit",
      description: "Virtual styling session for a black-tie New Year gala.",
      confirmedDate: atTime(tomorrow, 16, 0),
      confirmedTime: "16:00",
      meetingLink: "https://meet.google.com/demo-gala",
      meetingPlatform: "Google Meet",
      feeNGN: 40_000,
      status: ConsultationStatus.CONFIRMED,
      completedAt: null,
    },
    {
      bookingNumber: "DEMO-CB-004",
      offering: atelierOffering,
      consultantId: atelierOffering.consultantId,
      userId: null,
      clientName: "Aisha Mohammed",
      clientEmail: "aisha.mohammed@gmail.com",
      clientPhone: "+234 802 345 6789",
      occasion: "Anniversary dinner wardrobe",
      description: "Completed in-person consultation for anniversary dinner ensemble.",
      confirmedDate: addDays(new Date(), -7),
      confirmedTime: "11:30",
      atelierAddress: "Prudential Atelier, Victoria Island, Lagos",
      feeNGN: 150_000,
      status: ConsultationStatus.COMPLETED,
      completedAt: addDays(new Date(), -7),
    },
  ];

  for (const b of bookings) {
    await prisma.consultationBooking.upsert({
      where: { bookingNumber: b.bookingNumber },
      update: {
        status: b.status,
        confirmedDate: b.confirmedDate,
        confirmedTime: b.confirmedTime,
        paymentStatus: PaymentStatus.PAID,
        paidAt: addDays(b.confirmedDate, -2),
        completedAt: b.completedAt,
      },
      create: {
        bookingNumber: b.bookingNumber,
        offeringId: b.offering.id,
        consultantId: b.consultantId,
        userId: b.userId,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        clientCountry: "NG",
        occasion: b.occasion,
        description: b.description,
        referenceImages: [],
        confirmedDate: b.confirmedDate,
        confirmedTime: b.confirmedTime,
        meetingLink: b.meetingLink,
        meetingPlatform: b.meetingPlatform,
        atelierAddress: b.atelierAddress,
        feeNGN: b.feeNGN,
        currency: Currency.NGN,
        paymentStatus: PaymentStatus.PAID,
        paymentGateway: PaymentGateway.PAYSTACK,
        paymentRef: `demo-${b.bookingNumber}`,
        paidAt: addDays(b.confirmedDate, -2),
        status: b.status,
        completedAt: b.completedAt,
      },
    });
  }

  console.log(`  ✅ ${bookings.length} consultation bookings`);
}

async function seedBlogPosts() {
  console.log("\n📝 Seeding demo blog posts…");
  const admin = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true, name: true },
  });
  const authorId = admin?.id ?? "demo-author";
  const authorName = admin?.name ?? "Prudential Atelier";

  const posts = [
    {
      slug: "inside-the-beading-room",
      title: "Inside the beading room: 400 hours by hand",
      category: "Behind the Scenes",
      readTime: 6,
      publishedAt: addDays(new Date(), -10),
      content: `<p>Step inside our beading atelier on Victoria Island and you will hear only the soft click of needle on silk. Each Prudential commission that carries hand embellishment passes through this room — a quiet studio where patience is as essential as skill.</p>
<p>Our head beaders, many of whom have worked with Mrs. Prudent Gabriel-Okopi for over a decade, apply crystals and pearls one at a time. There are no shortcuts: a single bridal bodice can require four hundred hours of labour, spread across weeks of meticulous work.</p>
<p>Every piece that leaves this room is unique. The pattern never repeats exactly — it responds to the fabric, the light, and the woman who will wear it. That is the artistry we protect, and the standard our clients trust.</p>`,
    },
    {
      slug: "choosing-silk-lagos-ceremony",
      title: "Choosing silk for a Lagos ceremony: a complete guide",
      category: "Style Guides",
      readTime: 4,
      publishedAt: addDays(new Date(), -18),
      content: `<p>Lagos ceremonies demand fabrics that breathe in humidity yet photograph beautifully under ballroom lighting. Silk remains our first recommendation for evening galas and white weddings — but not all silks behave the same.</p>
<p>For traditional ceremonies and chieftaincy celebrations, we often pair silk bases with Aso-Oke or George wrappers for structure and cultural resonance. Corporate events favour matte silk crepes and wool-silk blends that hold a sharp line through long receptions.</p>
<p>During your consultation we drape options on you in natural light — because the right silk is always a conversation between climate, occasion, and how you want to feel when you enter the room.</p>`,
    },
    {
      slug: "art-of-second-fitting",
      title: "The art of the second fitting",
      category: "Bridal",
      readTime: 5,
      publishedAt: addDays(new Date(), -25),
      content: `<p>The second fitting is where bespoke fashion becomes personal. The first fitting confirms structure; the second refines the silhouette to your body and your movement.</p>
<p>Clients should expect honest feedback from our tailors, pin markings for final adjustments, and time to walk, sit, and dance in the toile or nearly-finished garment. Bring the undergarments and shoes you plan to wear.</p>
<p>We schedule second fittings at least three weeks before delivery for bridal commissions — because perfection cannot be rushed, and you deserve to feel certain before the beading and finishing stages begin.</p>`,
    },
  ];

  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        content: p.content,
        category: p.category,
        status: BlogStatus.PUBLISHED,
        publishedAt: p.publishedAt,
        readTime: p.readTime,
        authorId,
        authorName,
      },
      create: {
        title: p.title,
        slug: p.slug,
        excerpt: p.content.replace(/<[^>]+>/g, "").slice(0, 160),
        content: p.content,
        category: p.category,
        tags: ["demo", p.category.toLowerCase()],
        status: BlogStatus.PUBLISHED,
        publishedAt: p.publishedAt,
        readTime: p.readTime,
        authorId,
        authorName,
      },
    });
  }

  console.log(`  ✅ ${posts.length} blog posts`);
}

async function seedInvoices() {
  console.log("\n🧾 Seeding demo invoices…");

  const inv1Items = [
    lineItem("Custom Asoebi Gown — Design & Construction", 1, 500_000),
    lineItem("Premium Aso-Oke Fabric", 3, 45_000),
    lineItem("Crystal Beading & Embellishment", 1, 15_000),
  ];
  const inv1Subtotal = inv1Items.reduce((s, i) => s + i.amount, 0);

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2847" },
    update: {
      clientName: "Amaka Nwosu",
      clientEmail: "amaka.nwosu@gmail.com",
      status: InvoiceStatus.PARTIALLY_PAID,
      lineItems: inv1Items,
      subtotal: inv1Subtotal,
      total: 650_000,
      depositRequired: 325_000,
      depositPaid: 325_000,
      balanceDue: 325_000,
      notes: "Linked to bespoke order ORD-2847",
    },
    create: {
      invoiceNumber: "INV-2847",
      clientName: "Amaka Nwosu",
      clientEmail: "amaka.nwosu@gmail.com",
      clientPhone: "+234 803 456 7890",
      clientCountry: "Nigeria",
      status: InvoiceStatus.PARTIALLY_PAID,
      lineItems: inv1Items,
      subtotal: inv1Subtotal,
      total: 650_000,
      depositRequired: 325_000,
      depositPaid: 325_000,
      balanceDue: 325_000,
      paymentHistory: [
        {
          recordedAt: addDays(new Date(), -30).toISOString(),
          amount: 325_000,
          method: "Bank Transfer",
          reference: "DEMO-PAY-2847",
        },
      ],
      notes: "Linked to bespoke order ORD-2847",
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2848" },
    update: {
      clientName: "Chisom Eze",
      clientEmail: "chisom.eze@yahoo.com",
      status: InvoiceStatus.PAID,
      total: 1_850_000,
      depositPaid: 1_850_000,
      balanceDue: 0,
      paidAt: addDays(new Date(), -5),
      notes: "Linked to bespoke order ORD-2848 — fully paid",
    },
    create: {
      invoiceNumber: "INV-2848",
      clientName: "Chisom Eze",
      clientEmail: "chisom.eze@yahoo.com",
      clientPhone: "+234 805 234 5678",
      clientCountry: "Nigeria",
      status: InvoiceStatus.PAID,
      lineItems: [
        lineItem("Bridal Gown — Couture Construction", 1, 1_200_000),
        lineItem("Reception Dress", 1, 550_000),
        lineItem("Hand Beading Package", 1, 100_000),
      ],
      subtotal: 1_850_000,
      total: 1_850_000,
      depositRequired: 925_000,
      depositPaid: 1_850_000,
      balanceDue: 0,
      paidAt: addDays(new Date(), -5),
      paymentHistory: [
        {
          recordedAt: addDays(new Date(), -60).toISOString(),
          amount: 925_000,
          method: "Paystack",
        },
        {
          recordedAt: addDays(new Date(), -5).toISOString(),
          amount: 925_000,
          method: "Bank Transfer",
        },
      ],
      notes: "Linked to bespoke order ORD-2848",
    },
  });

  const inv3Items = [
    lineItem("Style Consultation — 90 minutes", 1, 150_000),
    lineItem("Fabric Sourcing & Mood Board", 1, 190_000),
  ];

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2849" },
    update: {
      clientName: "Yetunde Adeyemi",
      clientEmail: "yetunde.adeyemi@gmail.com",
      status: InvoiceStatus.SENT,
      total: 340_000,
      balanceDue: 340_000,
      sentAt: addDays(new Date(), -3),
    },
    create: {
      invoiceNumber: "INV-2849",
      clientName: "Yetunde Adeyemi",
      clientEmail: "yetunde.adeyemi@gmail.com",
      clientPhone: "+234 806 345 6789",
      clientCountry: "Nigeria",
      status: InvoiceStatus.SENT,
      lineItems: inv3Items,
      subtotal: 340_000,
      total: 340_000,
      depositRequired: 170_000,
      depositPaid: 0,
      balanceDue: 340_000,
      sentAt: addDays(new Date(), -3),
      notes: "Standalone invoice — consultation and sourcing",
    },
  });

  console.log("  ✅ 3 invoices");
}

async function seedReviews(
  clientMap: Record<string, { userId: string; profileId: string }>,
  productIds: Record<string, string>,
) {
  console.log("\n⭐ Seeding demo reviews…");

  const sandra = clientMap["sandra.dike@gmail.com"];
  const chisom = clientMap["chisom.eze@yahoo.com"];
  const formalProductId = productIds["nneka-aso-ebi-set"];
  const bridalProductId = productIds["the-zahra-bridal-gown"];

  if (sandra && formalProductId) {
    const existing = await prisma.review.findFirst({
      where: { userId: sandra.userId, productId: formalProductId },
    });
    if (!existing) {
      await prisma.review.create({
        data: {
          userId: sandra.userId,
          productId: formalProductId,
          rating: 5,
          title: "Absolutely breathtaking",
          body: "Mrs. Prudent and her team created exactly what I envisioned for my husband's chieftaincy ceremony. The fabric quality, the beading, the fit — everything was perfect. I received so many compliments. I will never go anywhere else.",
          isApproved: true,
          isVerified: true,
          showOnHomepage: true,
        },
      });
    } else {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: 5,
          title: "Absolutely breathtaking",
          body: "Mrs. Prudent and her team created exactly what I envisioned for my husband's chieftaincy ceremony. The fabric quality, the beading, the fit — everything was perfect. I received so many compliments. I will never go anywhere else.",
          isApproved: true,
          isVerified: true,
          showOnHomepage: true,
        },
      });
    }
  }

  if (chisom && bridalProductId) {
    const existing = await prisma.review.findFirst({
      where: { userId: chisom.userId, productId: bridalProductId },
    });
    if (!existing) {
      await prisma.review.create({
        data: {
          userId: chisom.userId,
          productId: bridalProductId,
          rating: 5,
          title: "Worth every kobo",
          body: "The attention to detail is unmatched. From the consultation to the final delivery, the entire experience felt truly luxurious. My bridal gown was a masterpiece.",
          isApproved: true,
          isVerified: true,
          showOnHomepage: true,
        },
      });
    } else {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: 5,
          title: "Worth every kobo",
          body: "The attention to detail is unmatched. From the consultation to the final delivery, the entire experience felt truly luxurious. My bridal gown was a masterpiece.",
          isApproved: true,
          isVerified: true,
          showOnHomepage: true,
        },
      });
    }
  }

  if (sandra) {
    await prisma.user.update({
      where: { id: sandra.userId },
      data: { image: "https://images.unsplash.com/photo-1589156191108-cdcff793e2f2?w=800&q=80" },
    });
  }
  if (chisom) {
    await prisma.user.update({
      where: { id: chisom.userId },
      data: { image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80" },
    });
  }

  console.log("  ✅ 2 reviews");
}

async function seedLoyaltyTransactions(clientMap: Record<string, { userId: string; profileId: string }>) {
  console.log("\n🎁 Seeding loyalty transactions…");

  const amaka = clientMap["amaka.nwosu@gmail.com"];
  const chisom = clientMap["chisom.eze@yahoo.com"];

  if (amaka) {
    await prisma.pointsTransaction.deleteMany({
      where: { userId: amaka.userId, description: { startsWith: "[Demo]" } },
    });
    const amakaTx = [
      { monthsAgo: 11, amount: 420, type: PointsType.EARNED_PURCHASE, desc: "[Demo] The Adaeze Gown purchase" },
      { monthsAgo: 8, amount: 380, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Evening wear commission" },
      { monthsAgo: 5, amount: 250, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Accessories bundle" },
      { monthsAgo: 2, amount: 150, type: PointsType.EARNED_REVIEW, desc: "[Demo] Verified review bonus" },
    ];
    let balance = 0;
    for (const tx of amakaTx) {
      balance += tx.amount;
      await prisma.pointsTransaction.create({
        data: {
          userId: amaka.userId,
          type: tx.type,
          amount: tx.amount,
          balanceAfter: balance,
          description: tx.desc,
          createdAt: addDays(new Date(), -tx.monthsAgo * 30),
        },
      });
    }
  }

  if (chisom) {
    await prisma.pointsTransaction.deleteMany({
      where: { userId: chisom.userId, description: { startsWith: "[Demo]" } },
    });
    const chisomTx = [
      { monthsAgo: 10, amount: 1200, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Bridal deposit — Zahra gown" },
      { monthsAgo: 7, amount: 800, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Reception dress payment" },
      { monthsAgo: 6, amount: 500, type: PointsType.EARNED_REFERRAL, desc: "[Demo] Referral — Mrs. Adebayo" },
      { monthsAgo: 4, amount: 650, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Beading upgrade package" },
      { monthsAgo: 3, amount: 400, type: PointsType.EARNED_PURCHASE, desc: "[Demo] Final fitting accessories" },
      { monthsAgo: 1, amount: 200, type: PointsType.EARNED_REVIEW, desc: "[Demo] Post-delivery review bonus" },
    ];
    let balance = 0;
    for (const tx of chisomTx) {
      balance += tx.amount;
      await prisma.pointsTransaction.create({
        data: {
          userId: chisom.userId,
          type: tx.type,
          amount: tx.amount,
          balanceAfter: balance,
          description: tx.desc,
          createdAt: addDays(new Date(), -tx.monthsAgo * 30),
        },
      });
    }
  }

  console.log("  ✅ Loyalty transaction history");
}

async function seedQuotation() {
  console.log("\n📋 Seeding demo quotation…");

  const items = [
    lineItem("Bridal consultation package", 1, 150_000),
    lineItem("Design development & sketches", 1, 180_000),
    lineItem("Premium silk & lace sourcing", 1, 150_000),
  ];

  await prisma.quotation.upsert({
    where: { quoteRef: "QUO-001" },
    update: {
      clientName: "Ngozi Peters",
      clientEmail: "ngozi.peters@gmail.com",
      status: QuoteStatus.APPROVED,
      lineItems: items,
      subtotal: 480_000,
      total: 480_000,
      approvedAt: addDays(new Date(), -12),
      notes: "Bridal consultation package — approved for December wedding",
    },
    create: {
      quoteRef: "QUO-001",
      clientName: "Ngozi Peters",
      clientEmail: "ngozi.peters@gmail.com",
      clientPhone: "+234 704 678 9012",
      lineItems: items,
      subtotal: 480_000,
      total: 480_000,
      status: QuoteStatus.APPROVED,
      approvedAt: addDays(new Date(), -12),
      sentAt: addDays(new Date(), -20),
      notes: "Bridal consultation package — approved for December wedding",
      createdBy: "demo-seed",
    },
  });

  console.log("  ✅ Quotation QUO-001");
}

async function seedCollections(productIds: Record<string, string>) {
  console.log("\n📁 Seeding demo collections…");

  const collections = [
    {
      name: "Rich & Regal",
      slug: "rich-regal",
      description:
        "Commanding pieces for the woman who owns every room she enters. Structured silhouettes, premium fabrics, unapologetic presence.",
      season: "Spring/Summer 2026",
      displayOrder: 0,
      coverImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
      coverImageAlt: "Rich & Regal collection",
      productSlugs: ["the-adaeze-gown", "lumi-tailored-suit", "nneka-aso-ebi-set"],
    },
    {
      name: "Church Girl",
      slug: "church-girl",
      description:
        "Refined, modest, and effortlessly elegant. For the woman whose Sunday best is always extraordinary.",
      season: "Spring/Summer 2026",
      displayOrder: 1,
      coverImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
      coverImageAlt: "Church Girl collection",
      productSlugs: ["ember-silk-wrap", "ife-bias-slip-dress"],
    },
    {
      name: "La Femme",
      slug: "la-femme",
      description:
        "Soft, feminine, and deeply romantic. Pieces that move with you and speak for you.",
      season: "Spring/Summer 2026",
      displayOrder: 2,
      coverImage: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800",
      coverImageAlt: "La Femme collection",
      productSlugs: ["zara-flower-girl-set", "kito-junior-tuxedo"],
    },
  ] as const;

  for (const c of collections) {
    const collection = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        season: c.season,
        coverImage: c.coverImage,
        coverImageAlt: c.coverImageAlt,
        isPublished: true,
        displayOrder: c.displayOrder,
      },
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        season: c.season,
        coverImage: c.coverImage,
        coverImageAlt: c.coverImageAlt,
        isPublished: true,
        displayOrder: c.displayOrder,
      },
    });

    await prisma.collection.updateMany({
      where: { slug: "rich-and-regal" },
      data: { isPublished: false },
    });

    await prisma.collectionProduct.deleteMany({ where: { collectionId: collection.id } });

    for (let i = 0; i < c.productSlugs.length; i++) {
      const productId = productIds[c.productSlugs[i]];
      if (!productId) continue;
      await prisma.collectionProduct.create({
        data: {
          collectionId: collection.id,
          productId,
          sortOrder: i,
        },
      });
    }

    console.log(`  ✅ Collection: ${c.name}`);
  }
}

function printCredentials() {
  console.log("\n" + "=".repeat(60));
  console.log("DEMO CREDENTIALS — Prudential Atelier");
  console.log("=".repeat(60));
  console.log("\nAdmin (/admin-login):");
  console.log(`  Super Admin: ${SUPER_ADMIN_EMAIL}`);
  console.log("  Password:    [your existing admin password — see seed:admin]");
  console.log("\nStaff (/staff-login):");
  console.log("  Tunde Kareem: tunde.kareem@prudentgabriel.com / Staff@2024!");
  console.log("  (All demo staff use password: Staff@2024!)");
  console.log("\nClients (/login):");
  console.log("  Amaka Nwosu:  amaka.nwosu@gmail.com / Demo@2024!");
  console.log("  Chisom Eze:   chisom.eze@yahoo.com / Demo@2024!");
  console.log("  Bola Adeyemi: bola.adeyemi@gmail.com / Demo@2024!");
  console.log("  (All demo clients use password: Demo@2024!)");
  console.log("\n" + "=".repeat(60));
}

async function main() {
  console.log("🌱 Prudential Atelier — demo seed");
  console.log("   Luxury Nigerian fashion atelier demo data\n");

  const [clientHash, staffHash] = await Promise.all([
    hashPassword(DEMO_CLIENT_PASSWORD),
    hashPassword(DEMO_STAFF_PASSWORD),
  ]);

  const productIds = await seedProducts();
  const clientMap = await seedClients(clientHash);
  const staffMap = await seedStaff(staffHash);
  await seedBespokeOrders(clientMap, staffMap);
  await seedConsultations(clientMap);
  await seedBlogPosts();
  await seedInvoices();
  await seedReviews(clientMap, productIds);
  await seedLoyaltyTransactions(clientMap);
  await seedQuotation();
  await seedCollections(productIds);

  printCredentials();
  console.log("\n✅ Demo seed complete.\n");
}

main()
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
