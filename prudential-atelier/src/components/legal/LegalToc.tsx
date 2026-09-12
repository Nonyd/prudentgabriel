"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { LegalTocItem } from "@/lib/legal-copy";

export function LegalToc({ items }: { items: LegalTocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const listRef = useRef<HTMLOListElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!headings.length) return;

    const visible = new Map<string, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry);
          else visible.delete(entry.target.id);
        }
        const next = headings.find((heading) => visible.has(heading.id));
        if (next) setActiveId(next.id);
      },
      { rootMargin: "-20% 0px -66% 0px", threshold: [0, 0.25, 1] },
    );

    headings.forEach((heading) => observer.observe(heading));
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && items.some((item) => item.id === hash)) setActiveId(hash);

    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    if (!list || !activeId) return;

    const link = list.querySelector<HTMLAnchorElement>(`a[href="#${CSS.escape(activeId)}"]`);
    const row = link?.parentElement;
    if (!link || !row) return;

    if (marker) {
      marker.style.setProperty("--legal-toc-marker-h", `${link.offsetHeight}px`);
      marker.style.setProperty("--legal-toc-marker-y", `${row.offsetTop}px`);
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop) {
      const top = row.offsetTop - list.clientHeight / 3;
      list.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      const left = row.offsetLeft - 24;
      list.scrollTo({ left: Math.max(0, left), behavior });
    }
  }, [activeId]);

  function goTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    setActiveId(id);
    const target = document.getElementById(id);
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenisOn = document.documentElement.classList.contains("lenis");
    target.scrollIntoView({
      behavior: reduce || lenisOn ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav className="legal-toc" aria-label="Contents">
      <p className="legal-toc-label" id="legal-toc-heading">
        Contents
      </p>
      <div className="legal-toc-track">
        <span ref={markerRef} className="legal-toc-marker" aria-hidden="true" />
        <ol ref={listRef} className="legal-toc-list" aria-labelledby="legal-toc-heading" data-lenis-prevent>
          {items.map((item) => {
            const current = item.id === activeId;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={current ? "location" : undefined}
                  data-active={current ? "" : undefined}
                  onClick={(event) => goTo(event, item.id)}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
