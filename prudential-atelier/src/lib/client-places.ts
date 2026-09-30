import { prisma } from "@/lib/prisma";

/**
 * Slice BC4 — where her brides are. A count of clients by country, state and
 * city, from the address already held. Not a map and not tracking: one place
 * per client (her default saved address, else her latest), counted.
 *
 * A client with no saved address falls back to the country she gave when
 * booking a consultation; with neither she is counted as "not recorded".
 */

export const NOT_RECORDED = "Not recorded";

const COUNTRY_ALIASES: Record<string, string> = {
  ng: "Nigeria",
  nga: "Nigeria",
  uk: "United Kingdom",
  gb: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  us: "United States",
  usa: "United States",
  "united states of america": "United States",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (/^[a-z]/.test(part) ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join("");
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normaliseCountry(value: string | null | undefined): string {
  const v = clean(value);
  if (!v) return NOT_RECORDED;
  return COUNTRY_ALIASES[v.toLowerCase()] ?? titleCase(v);
}

/** "lagos state" → "Lagos"; "fct" / "Abuja FCT" → "FCT". */
export function normaliseState(value: string | null | undefined): string {
  let v = clean(value).replace(/\s+state$/i, "");
  if (!v) return NOT_RECORDED;
  if (/^(fct|f\.c\.t\.?|federal capital territory|abuja fct|fct abuja)$/i.test(v)) return "FCT";
  v = titleCase(v);
  return v;
}

export function normaliseCity(value: string | null | undefined): string {
  const v = clean(value);
  return v ? titleCase(v) : NOT_RECORDED;
}

export type ClientPlaceRow = {
  clientId: string;
  hasCommission: boolean;
  country: string | null;
  state: string | null;
  city: string | null;
};

export type PlaceCount = { name: string; clients: number; withCommission: number };
export type StateCount = PlaceCount & { cities: PlaceCount[] };
export type CountryCount = PlaceCount & { states: StateCount[] };

export type ClientPlaces = {
  total: number;
  located: number;
  notRecorded: number;
  countries: CountryCount[];
};

function bump(map: Map<string, PlaceCount>, name: string, hasCommission: boolean): PlaceCount {
  const hit = map.get(name) ?? { name, clients: 0, withCommission: 0 };
  hit.clients += 1;
  if (hasCommission) hit.withCommission += 1;
  map.set(name, hit);
  return hit;
}

const byCount = (a: PlaceCount, b: PlaceCount) =>
  (a.name === NOT_RECORDED ? 1 : 0) - (b.name === NOT_RECORDED ? 1 : 0) ||
  b.clients - a.clients ||
  a.name.localeCompare(b.name);

/** Count clients by country → state → city. Pure; one row per client. */
export function groupClientsByPlace(rows: ClientPlaceRow[]): ClientPlaces {
  const countries = new Map<string, PlaceCount>();
  const states = new Map<string, Map<string, PlaceCount>>();
  const cities = new Map<string, Map<string, PlaceCount>>();
  let notRecorded = 0;

  for (const row of rows) {
    const country = normaliseCountry(row.country);
    const state = normaliseState(row.state);
    const city = normaliseCity(row.city);
    if (country === NOT_RECORDED) notRecorded += 1;

    bump(countries, country, row.hasCommission);
    const stateMap = states.get(country) ?? new Map<string, PlaceCount>();
    states.set(country, stateMap);
    bump(stateMap, state, row.hasCommission);
    const cityKey = `${country}\u0000${state}`;
    const cityMap = cities.get(cityKey) ?? new Map<string, PlaceCount>();
    cities.set(cityKey, cityMap);
    bump(cityMap, city, row.hasCommission);
  }

  const out: CountryCount[] = Array.from(countries.values()).sort(byCount).map((c) => ({
    ...c,
    states: Array.from(states.get(c.name)?.values() ?? []).sort(byCount).map((s) => ({
      ...s,
      cities: Array.from(cities.get(`${c.name}\u0000${s.name}`)?.values() ?? []).sort(byCount),
    })),
  }));

  return { total: rows.length, located: rows.length - notRecorded, notRecorded, countries: out };
}

/** One place per client from the addresses already held. Read-only. */
export async function loadClientPlaceRows(): Promise<ClientPlaceRow[]> {
  const clients = await prisma.clientProfile.findMany({
    where: { user: { role: "CUSTOMER" } },
    select: {
      id: true,
      _count: { select: { bespokeOrders: true } },
      user: {
        select: {
          // Address has no timestamp; cuid ids sort by creation, so id desc is "latest".
          addresses: {
            orderBy: [{ isDefault: "desc" }, { id: "desc" }],
            take: 1,
            select: { country: true, state: true, city: true },
          },
          consultationBookings: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { clientCountry: true },
          },
        },
      },
    },
  });

  return clients.map((c) => {
    const address = c.user.addresses[0];
    return {
      clientId: c.id,
      hasCommission: c._count.bespokeOrders > 0,
      country: address?.country ?? c.user.consultationBookings[0]?.clientCountry ?? null,
      state: address?.state ?? null,
      city: address?.city ?? null,
    };
  });
}
