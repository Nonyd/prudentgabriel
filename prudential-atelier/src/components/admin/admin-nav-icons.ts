import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AreaChart,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Images,
  Inbox,
  Image as ImageIcon,
  Layout,
  LayoutDashboard,
  MessageSquare,
  Mail,
  Newspaper,
  Lock,
  Package,
  Palette,
  Receipt,
  Scissors,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  TrendingUp,
  Truck,
  Ticket,
  UserCircle,
  UserRoundCog,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { AdminNavItemDef, AdminNavSectionDef } from "@/lib/admin-route-access";

/** One icon per menu entry, shared by the desktop sidebar and the phone tab bar. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  quote: Truck,
  refund: AlertTriangle,
  consultations: CalendarDays,
  enquiries: Inbox,
  consultants: UserCircle,
  atelier: Scissors,
  alterations: Scissors,
  quotations: FileText,
  invoices: Receipt,
  payments: Wallet,
  transfers: Wallet,
  bank: Wallet,
  reports: BarChart3,
  traffic: AreaChart,
  clients: UserCircle,
  referrals: Users,
  staff: Users,
  attendance: ClipboardCheck,
  performance: TrendingUp,
  products: Package,
  collections: Layout,
  media: ImageIcon,
  guide: FileText,
  coupons: Ticket,
  shipping: Truck,
  sizing: Package,
  content: Layout,
  journal: Newspaper,
  reviews: MessageSquare,
  gallery: Images,
  careers: Briefcase,
  applications: FileText,
  messages: MessageSquare,
  templates: Mail,
  "send-email": Mail,
  unsubscribes: Mail,
  appearance: Palette,
  seo: Search,
  pages: FileText,
  social: Share2,
  jobs: Activity,
  "sys-emails": Mail,
  checkouts: ShoppingBag,
  logs: Activity,
  errors: AlertTriangle,
  settings: Settings,
  email: Mail,
  notifications: Mail,
  developer: Lock,
  users: UserRoundCog,
  roles: UserRoundCog,
  store: Warehouse,
  "store-items": Package,
  "store-book": FileText,
  "store-opening": ClipboardCheck,
};

export function iconFor(item: AdminNavItemDef): LucideIcon {
  return NAV_ICONS[item.icon] ?? Layout;
}

/** Shorter names where the menu label won't fit under a tab icon. */
const SHORT_LABELS: Record<string, string> = {
  "/admin": "Home",
  "/admin/orders": "Orders",
  "/admin/bespoke": "Pipeline",
  "/admin/consultations": "Bookings",
  "/admin/payments": "Payments",
  "/admin/store": "Store",
};

export function tabLabel(item: AdminNavItemDef): string {
  return SHORT_LABELS[item.href] ?? item.label;
}

/**
 * The phone tab bar: Home plus the three most-used sections this account can open. The atelier
 * pipeline, when it is one of them, takes the raised middle slot. Everything else is under More.
 */
const TAB_PRIORITY = [
  "/admin/orders",
  "/admin/bespoke",
  "/admin/clients",
  "/admin/consultations",
  "/admin/payments",
  "/admin/store",
  "/admin/products",
];

export const RAISED_TAB = "/admin/bespoke";

export function splitTabs(sections: AdminNavSectionDef[]) {
  const all = sections.flatMap((s) => s.items);
  const available = new Map(all.map((i) => [i.href, i]));
  const picked = TAB_PRIORITY.filter((h) => available.has(h)).slice(0, 3);
  const tabs = [available.get("/admin"), ...picked.map((h) => available.get(h))].filter(
    (i): i is AdminNavItemDef => Boolean(i),
  );
  const raisedAt = tabs.findIndex((t) => t.href === RAISED_TAB);
  if (raisedAt > -1 && tabs.length >= 3) {
    const [raised] = tabs.splice(raisedAt, 1);
    tabs.splice(2, 0, raised!);
  }
  const inTabs = new Set(tabs.map((t) => t.href));
  const more = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !inTabs.has(i.href)) }))
    .filter((s) => s.items.length > 0);
  return { tabs, more };
}
