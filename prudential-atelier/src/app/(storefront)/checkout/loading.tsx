export default function CheckoutLoading() {
  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-sm bg-sand/80" />
          <div className="h-24 animate-pulse rounded-sm bg-sand/60" />
          <div className="h-24 animate-pulse rounded-sm bg-sand/50" />
          <div className="h-14 animate-pulse rounded-sm bg-sand/70" />
        </div>
        <div className="h-64 animate-pulse rounded-sm bg-sand/60" />
      </div>
    </div>
  );
}
