import Link from "next/link";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

/** Plain page for an expired capability link — never an error shell. */
export function CapabilityExpiredPage(props?: { homeHref?: string }) {
  const home = props?.homeHref ?? "/";
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16 text-center">
      <h1 className="font-display text-3xl text-choc">{CAPABILITY_EXPIRED_COPY.title}</h1>
      <p className="mt-4 font-body text-base leading-relaxed text-text-mid">{CAPABILITY_EXPIRED_COPY.body}</p>
      <Link
        href={home}
        className="mt-10 inline-flex items-center justify-center self-center rounded-sm bg-choc px-6 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-cream"
      >
        Back to the house
      </Link>
    </main>
  );
}
