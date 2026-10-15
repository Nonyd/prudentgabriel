"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { FaqAnswer } from "@/components/faq/FaqAnswer";
import type { FaqEntry, FaqSection } from "@/lib/faq-content";

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9₦%]+/g, " ")
    .trim();
}

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: FaqEntry;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const panelId = `${item.id}-answer`;
  const buttonId = `${item.id}-question`;
  return (
    <div id={item.id} className="faq-item scroll-mt-[calc(var(--storefront-chrome-offset)+1.5rem)] border-b border-choc/15">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(item.id)}
          className="group flex w-full items-start justify-between gap-5 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <span className="font-display text-[1.2rem] font-normal leading-snug text-charcoal transition-colors group-hover:text-choc sm:text-[1.3rem]">
            {item.q}
          </span>
          <span
            aria-hidden
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
              open ? "rotate-45 border-gold bg-gold/10 text-choc" : "border-choc/20 text-charcoal-mid group-hover:border-choc/40"
            }`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-6 pr-2 sm:pr-12">
            <FaqAnswer blocks={item.a} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FaqBrowser({ sections, email }: { sections: FaqSection[]; email: string }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const index = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({ item, haystack: normalise(`${item.q} ${item.plain} ${section.title}`) })),
      })),
    [sections],
  );

  const total = useMemo(() => sections.reduce((n, s) => n + s.items.length, 0), [sections]);

  const filtered = useMemo(() => {
    const words = normalise(query).split(" ").filter(Boolean);
    return index.map((section) => ({
      ...section,
      items: words.length
        ? section.items.filter(({ haystack }) => words.every((w) => haystack.includes(w))).map(({ item }) => item)
        : section.items.map(({ item }) => item),
    }));
  }, [index, query]);

  const matchCount = filtered.reduce((n, s) => n + s.items.length, 0);
  const searching = query.trim().length > 0;

  const onSearch = (value: string) => {
    setQuery(value);
    // A narrow search opens its answers: the reader came for them.
    const words = normalise(value).split(" ").filter(Boolean);
    if (!words.length) return;
    const hits = index.flatMap((s) =>
      s.items.filter(({ haystack }) => words.every((w) => haystack.includes(w))).map(({ item }) => item.id),
    );
    if (hits.length > 0 && hits.length <= 3) setOpen(new Set(hits));
  };

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleIds = filtered.flatMap((s) => s.items.map((i) => i.id));
  const allOpen = visibleIds.length > 0 && visibleIds.every((id) => open.has(id));

  // A link to /faqs#q-… opens that answer.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("q-")) return;
      setOpen((prev) => new Set(prev).add(id));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  // The nav follows the section being read.
  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections, query]);

  return (
    <div>
      {/* Search */}
      <div className="mx-auto max-w-xl">
        <label htmlFor={searchId} className="sr-only">
          Search the questions
        </label>
        <div className="glass-2 glass-pill flex items-center gap-3 px-5 py-1.5 focus-within:border-gold">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-charcoal-light" strokeWidth={1.5} />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search sizes, delivery, returns…"
            autoComplete="off"
            className="min-w-0 flex-1 appearance-none bg-transparent py-2.5 font-body text-[15px] text-charcoal outline-none placeholder:text-charcoal-light [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-mid transition-colors hover:bg-choc/10 hover:text-choc"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="mt-3 text-center font-label text-[10px] uppercase tracking-[0.2em] text-charcoal-light">
          {searching
            ? `${matchCount} of ${total} ${matchCount === 1 ? "answer" : "answers"}`
            : `${total} answers in ${sections.length} sections`}
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        {/* Category nav: chips on mobile, sticky list on desktop */}
        <nav aria-label="FAQ sections" className="min-w-0 lg:sticky lg:top-[calc(var(--storefront-chrome-offset)+1.5rem)] lg:self-start">
          <p className="mb-4 hidden font-label text-[10px] uppercase tracking-[0.22em] text-charcoal-light lg:block">Sections</p>
          <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {filtered.map((section) => {
              const empty = section.items.length === 0;
              const isActive = active === section.id && !empty;
              return (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? "location" : undefined}
                    aria-disabled={empty || undefined}
                    tabIndex={empty ? -1 : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-label text-[11px] uppercase tracking-[0.14em] transition-colors lg:rounded-none lg:border-0 lg:border-l lg:py-1.5 lg:pl-4 lg:pr-0 lg:normal-case lg:tracking-normal lg:text-[14px] lg:font-body ${
                      empty
                        ? "pointer-events-none border-choc/10 text-charcoal-light/50"
                        : isActive
                          ? "border-choc bg-choc text-ivory lg:border-gold lg:bg-transparent lg:text-choc"
                          : "border-choc/20 text-charcoal-mid hover:border-choc/50 hover:text-choc lg:border-choc/10"
                    }`}
                  >
                    {section.title}
                    {searching && !empty ? (
                      <span className="font-label text-[10px] tabular-nums opacity-70">{section.items.length}</span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {visibleIds.length > 0 ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(allOpen ? new Set() : new Set(visibleIds))}
                className="font-label text-[10px] uppercase tracking-[0.2em] text-charcoal-mid underline-offset-4 transition-colors hover:text-choc hover:underline"
              >
                {allOpen ? "Close all" : "Open all"}
              </button>
            </div>
          ) : null}

          {matchCount === 0 ? (
            <div className="glass-opaque px-6 py-12 text-center sm:px-10">
              <p className="font-display text-2xl font-light text-charcoal">No questions match</p>
              <p className="mx-auto mt-3 max-w-md font-body text-[15px] leading-7 text-charcoal-mid">
                Ask us in the chat, or write to{" "}
                <a
                  href={`mailto:${email}`}
                  className="break-words text-choc underline decoration-gold/60 underline-offset-[3px] hover:decoration-choc"
                >
                  {email}
                </a>
                . We will answer you personally.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-6 font-label text-[10px] uppercase tracking-[0.2em] text-choc underline underline-offset-4"
              >
                Show all questions
              </button>
            </div>
          ) : null}

          <div className="space-y-14 lg:space-y-20">
            {filtered.map((section, i) =>
              section.items.length ? (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className="scroll-mt-[calc(var(--storefront-chrome-offset)+1.5rem)]"
                >
                  <div className="mb-4 flex items-baseline gap-4">
                    <span aria-hidden className="font-label text-[11px] tabular-nums tracking-[0.2em] text-gold">
                      {String(sections.findIndex((s) => s.id === section.id) + 1 || i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h2
                        id={`${section.id}-title`}
                        className="font-display text-[1.9rem] font-light leading-tight text-charcoal sm:text-[2.2rem]"
                      >
                        {section.title}
                      </h2>
                      {section.intro ? (
                        <p className="mt-1.5 font-body text-sm italic leading-6 text-charcoal-light">{section.intro}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="border-t border-choc/15">
                    {section.items.map((item) => (
                      <FaqItem key={item.id} item={item} open={open.has(item.id)} onToggle={toggle} />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
