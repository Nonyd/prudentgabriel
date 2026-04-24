import Link from "next/link";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const code = searchParams.error ?? "Configuration";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6">
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-gold">Authentication</p>
      <h1 className="mt-4 font-display text-3xl text-charcoal">Something went wrong</h1>
      <p className="mt-3 max-w-md text-center font-body text-sm text-charcoal-light">
        {code === "AccessDenied"
          ? "Access was denied. You may need to use a different account or sign in with email."
          : "We could not complete sign-in. Please try again."}
      </p>
      <Link
        href="/auth/login"
        className="mt-8 font-label text-[11px] uppercase tracking-[0.15em] text-wine underline-offset-4 hover:underline"
      >
        Return to sign in
      </Link>
    </div>
  );
}
