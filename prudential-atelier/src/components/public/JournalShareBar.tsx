"use client";

export function JournalShareBar({ title, shareUrl }: { title: string; shareUrl: string }) {
  return (
    <div className="mx-auto mt-12 flex max-w-3xl flex-wrap gap-3 border-t border-sand pt-8">
      <button
        type="button"
        className="btn-ghost-light text-[10px]"
        onClick={() => {
          void navigator.clipboard.writeText(shareUrl);
        }}
      >
        Copy link
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost-light text-[10px]"
      >
        WhatsApp
      </a>
    </div>
  );
}
