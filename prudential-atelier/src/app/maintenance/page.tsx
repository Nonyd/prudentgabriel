import Image from "next/image";
import Link from "next/link";
import { InstagramIcon } from "@/components/icons/SocialIcons";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getMaintenanceMessage(): Promise<string> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: "maintenance_mode_message" },
      select: { value: true },
    });
    return row?.value || "We're making some improvements. Check back soon.";
  } catch {
    return "We're making some improvements. Check back soon.";
  }
}

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center"
      style={{ background: "#442913" }}
    >
      <div
        className="mb-8 flex h-[108px] w-[108px] items-center justify-center rounded-full"
        style={{ border: "1.5px solid #f4ece4" }}
      >
        <Image
          src="/images/pg-mark.png"
          alt="Prudential Atelier"
          width={88}
          height={88}
          priority
          className="h-[88px] w-[88px] rounded-full object-cover"
        />
      </div>

      <div>
        <p
          className="font-serif text-2xl font-normal tracking-wide"
          style={{ color: "#e2d1c2", fontFamily: "var(--font-cormorant), Cormorant Garamond, serif" }}
        >
          PRUDENTIAL
        </p>
        <p
          className="mt-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.35em]"
          style={{ color: "#98755b", fontFamily: "var(--font-jost), Jost, sans-serif" }}
        >
          / ATELIER
        </p>
      </div>

      <div className="my-4 h-px w-10" style={{ background: "#C9A84C" }} />

      <h1
        className="max-w-xl font-serif text-[52px] font-light leading-tight"
        style={{ color: "#e2d1c2", fontFamily: "var(--font-cormorant), Cormorant Garamond, serif" }}
      >
        We&apos;ll be back shortly.
      </h1>

      <p
        className="mt-6 max-w-[480px] font-serif text-base leading-relaxed"
        style={{ color: "#d4bbac", fontFamily: "var(--font-lora), Lora, serif" }}
      >
        {message}
      </p>

      <div className="mt-12 space-y-2">
        <p
          className="font-sans text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "#a08060", fontFamily: "var(--font-jost), Jost, sans-serif" }}
        >
          Follow us for updates:
        </p>
        <a
          href="https://instagram.com/prudentgabriel"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-sans text-sm transition-colors hover:opacity-90"
          style={{ color: "#98755b" }}
        >
          <InstagramIcon size={16} className="shrink-0" />
          @prudentgabriel
        </a>
      </div>

      <div className="mt-12 space-y-2">
        <p
          className="font-sans text-[11px]"
          style={{ color: "#a08060", fontFamily: "var(--font-jost), Jost, sans-serif" }}
        >
          Already have an account?
        </p>
        <Link
          href="/login"
          className="font-sans text-sm font-medium transition-colors hover:opacity-90"
          style={{ color: "#98755b" }}
        >
          Log in →
        </Link>
      </div>
    </div>
  );
}
