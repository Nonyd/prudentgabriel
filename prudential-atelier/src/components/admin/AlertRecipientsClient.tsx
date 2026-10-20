"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Bell, Mail } from "lucide-react";

type Candidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  mailable: boolean;
  office: boolean;
  chat: boolean;
};
type KindView = {
  id: string;
  label: string;
  about: string;
  hasEmail: boolean;
  hasBell: boolean;
  bellDefault: string | null;
  email: string[] | null;
  addresses: string[] | null;
  bell: string[] | null;
};
type View = {
  kinds: KindView[];
  candidates: Candidate[];
  staffRouted: { label: string; goesTo: string }[];
};
type Channel = "email" | "bell";

async function save(kind: string, channel: Channel, userIds: string[] | null, addresses?: string[]): Promise<View> {
  const res = await fetch("/api/admin/settings/alert-recipients", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, channel, userIds, ...(channel === "email" ? { addresses: addresses ?? [] } : {}) }),
  });
  const j = (await res.json().catch(() => ({}))) as View & { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not save");
  return j;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF_ADMIN: "Staff admin",
  BESPOKE_MANAGER: "Atelier manager",
  RTW_MANAGER: "Ready-to-wear manager",
  CONTENT_MANAGER: "Content manager",
  FINANCE_MANAGER: "Finance manager",
  HR_MANAGER: "HR manager",
  CONSULTATION_MANAGER: "Consultation manager",
  STORE_MANAGER: "Store manager",
  STAFF: "Staff",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase();
}

/** One channel of one alert: who is told now, and the means to change it. */
function ChannelRow({
  kind,
  channel,
  named,
  addresses,
  defaultLabel,
  candidates,
  onSaved,
}: {
  kind: KindView;
  channel: Channel;
  named: string[] | null;
  /** Email only: addresses that are not a portal user. */
  addresses: string[] | null;
  /** Bell only: who gets it while nobody is named. */
  defaultLabel: string;
  candidates: Candidate[];
  onSaved: (v: View) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>(named ?? []);
  const [extra, setExtra] = useState((addresses ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const isEmail = channel === "email";

  useEffect(() => {
    if (!editing) {
      setPicked(named ?? []);
      setExtra((addresses ?? []).join("\n"));
    }
  }, [named, addresses, editing]);

  const extraList = extra
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const people = (named ?? [])
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is Candidate => Boolean(c));
  const Icon = channel === "email" ? Mail : Bell;
  const channelLabel = channel === "email" ? "Email" : "Bell";

  async function run(ids: string[] | null) {
    const total = (ids?.length ?? 0) + (isEmail ? extraList.length : 0);
    if (isEmail && total === 0 && !window.confirm(`Nobody will be emailed about ${kind.label.toLowerCase()}. Continue?`)) {
      return;
    }
    setBusy(true);
    try {
      onSaved(await save(kind.id, channel, ids, isEmail ? extraList : undefined));
      setEditing(false);
      toast.success(
        isEmail
          ? total
            ? `${kind.label}: email goes to ${total} named`
            : `${kind.label}: nobody is emailed`
          : ids
            ? `${kind.label}: bell goes to ${ids.length} named`
            : `${kind.label}: back to default`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 rounded-xl border border-sand/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-sans text-10px uppercase tracking-wider text-text-mid">
            <Icon className="h-3.5 w-3.5" aria-hidden /> {channelLabel}
          </p>
          {people.length || (isEmail && addresses?.length) ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {people.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full bg-[color-mix(in_srgb,var(--choc)_10%,transparent)] px-2.5 py-0.5 font-sans text-xs text-choc"
                  title={p.email}
                >
                  {p.name}
                </li>
              ))}
              {isEmail
                ? (addresses ?? []).map((a) => (
                    <li
                      key={a}
                      className="rounded-full border border-sand px-2.5 py-0.5 font-sans text-xs text-choc"
                      title="An address that is not a portal user"
                    >
                      {a}
                    </li>
                  ))
                : null}
            </ul>
          ) : isEmail ? (
            <p className="mt-1.5 font-sans text-sm text-text-mid">
              <span className="text-choc">Nobody</span> · not emailed to anyone
            </p>
          ) : (
            <p className="mt-1.5 font-sans text-sm text-text-mid">
              <span className="text-choc">Default</span> · {defaultLabel}
            </p>
          )}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Change who gets ${kind.label} by ${channel === "email" ? "email" : "the bell"}`}
            className="shrink-0 font-sans text-xs text-choc underline underline-offset-2"
          >
            Change
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 border-t border-sand/70 pt-3">
          <fieldset>
            <legend className="sr-only">
              {kind.label}, {channelLabel}
            </legend>
            {candidates.map((c) => {
              const blocked = channel === "email" && !c.mailable;
              return (
              <label
                key={c.id}
                className={`flex min-h-[36px] items-center gap-2.5 font-sans text-sm text-choc ${blocked ? "opacity-50" : "cursor-pointer"}`}
                title={blocked ? "This address does not receive mail" : undefined}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--choc)]"
                  aria-label={`${c.name} (${c.email})`}
                  checked={picked.includes(c.id)}
                  disabled={busy || (blocked && !picked.includes(c.id))}
                  onChange={(e) =>
                    setPicked((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))
                  }
                />
                <span className="min-w-0 truncate">
                  {c.name}
                  {c.email !== c.name ? <span className="ml-1.5 font-sans text-11px text-text-mid">{c.email}</span> : null}
                  {blocked ? <span className="ml-1.5 font-sans text-11px text-text-mid">· does not receive mail</span> : null}
                </span>
                <span className="ml-auto shrink-0 font-sans text-11px text-text-mid">{roleLabel(c.role)}</span>
              </label>
              );
            })}
          </fieldset>
          {isEmail ? (
            <label className="mt-3 block font-sans text-xs text-text-mid">
              Other addresses (not a portal user), one per line
              <textarea
                rows={2}
                value={extra}
                disabled={busy}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="orders@example.com"
                className="mt-1 block w-full rounded-lg border border-sand bg-transparent px-2.5 py-1.5 font-sans text-sm text-choc"
              />
            </label>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || (!isEmail && picked.length === 0)}
              onClick={() => void run(picked.length ? picked : null)}
              className="min-h-[36px] rounded-full bg-[var(--choc)] px-4 font-sans text-xs uppercase tracking-wider text-[var(--bg-card)] disabled:opacity-40"
            >
              Save
            </button>
            {!isEmail && named ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(null)}
                className="min-h-[36px] rounded-full border border-sand px-4 font-sans text-xs uppercase tracking-wider text-choc"
              >
                Use default
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="min-h-[36px] px-2 font-sans text-xs text-text-mid"
            >
              Cancel
            </button>
          </div>
          {picked.length === 0 && !isEmail ? (
            <p className="mt-2 font-sans text-11px text-text-mid">Tick at least one person, or use the default.</p>
          ) : null}
          {isEmail && picked.length === 0 && extraList.length === 0 ? (
            <p className="mt-2 font-sans text-11px text-text-mid">Nobody chosen: this will not be emailed to anyone.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Settings → Who is told. Prudent Gabriel's Super Admin names who receives each
 * kind of house alert, by email and by the bell. Staff work stays with staff.
 */
export function AlertRecipientsClient() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/alert-recipients", { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as View & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not load");
      setView(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="mb-4 block w-fit font-body text-11px font-medium uppercase tracking-[0.12em] text-text-mid hover:text-ink"
        >
          ← Settings
        </Link>
        <h1 className="admin-heading-pill glass-1 glass-pill font-display text-3xl text-choc">Who is told</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm text-text-mid">
          Choose who receives each kind of alert, by email and on the bell. This is the only place alert emails
          are addressed: each one goes to exactly the people and addresses listed here, and to nobody else. On the
          bell, until you choose, an alert goes to everyone who handles it.
        </p>
      </div>

      {error ? (
        <p className="glass-opaque p-5 font-sans text-sm text-text-mid">{error}</p>
      ) : !view ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass-opaque h-[140px] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {view.kinds.map((k) => (
              <section key={k.id} className="glass-opaque p-4 sm:p-5">
                <h2 className="font-display text-lg text-choc">{k.label}</h2>
                <p className="mt-0.5 font-sans text-xs text-text-mid">{k.about}</p>
                <div className={`mt-3 grid gap-3 ${k.hasEmail && k.hasBell ? "md:grid-cols-2" : ""}`}>
                  {k.hasEmail ? (
                    <ChannelRow
                      kind={k}
                      channel="email"
                      named={k.email}
                      addresses={k.addresses}
                      defaultLabel=""
                      candidates={view.candidates.filter((c) => c.office || (k.id === "chat" && c.chat))}
                      onSaved={setView}
                    />
                  ) : null}
                  {k.hasBell ? (
                    <ChannelRow
                      kind={k}
                      channel="bell"
                      named={k.bell}
                      addresses={null}
                      defaultLabel={k.bellDefault ?? "Everyone who handles it"}
                      candidates={view.candidates.filter((c) => c.office || (k.id === "chat" && c.chat))}
                      onSaved={setView}
                    />
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <section className="glass-opaque p-4 sm:p-5">
            <h2 className="font-display text-lg text-choc">Staff work goes to the staff</h2>
            <p className="mt-0.5 font-sans text-xs text-text-mid">
              These are not chosen here. They reach the people whose job it is.
            </p>
            <ul className="mt-3 divide-y divide-sand/60">
              {view.staffRouted.map((s) => (
                <li key={s.label} className="flex flex-col gap-0.5 py-2 font-sans text-sm sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-choc">{s.label}</span>
                  <span className="text-text-mid sm:text-right">{s.goesTo}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
