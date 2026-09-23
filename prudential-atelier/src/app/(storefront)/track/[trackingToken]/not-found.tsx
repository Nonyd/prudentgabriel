import Link from "next/link";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";

/** Expired or unknown tracking link: a real 404 that still lets the client look the order up. */
export default function TrackTokenNotFound() {
  return (
    <div className="min-h-screen">
      <TrackSearchForm notice="That tracking link has expired or is no longer valid. Look your order up below, or contact the atelier." />
      <div className="pb-16 text-center">
        <Link
          href="/contact"
          className="inline-block border border-choc px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-choc"
        >
          Contact the atelier
        </Link>
      </div>
    </div>
  );
}
