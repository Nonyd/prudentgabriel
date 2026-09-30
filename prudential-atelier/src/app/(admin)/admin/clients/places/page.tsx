import { groupClientsByPlace, loadClientPlaceRows, NOT_RECORDED } from "@/lib/client-places";

export const dynamic = "force-dynamic";

/**
 * Slice BC4 — where her brides are. Counts by country, state and city from the
 * addresses already held. No names, no map. Gated like its API: `clients` or
 * `reports` (see admin-route-access).
 */
export default async function ClientPlacesPage() {
  const places = groupClientsByPlace(await loadClientPlaceRows());

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Where clients are</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          {places.total} client{places.total === 1 ? "" : "s"}, counted by the address on file (her default, else
          her latest), or the country she gave at booking. {places.notRecorded} with no place recorded.
        </p>
      </div>

      {places.countries.map((country) => (
        <section key={country.name} className="card-surface p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg text-ink">{country.name}</h2>
            <p className="font-sans text-sm text-text-mid">
              {country.clients} client{country.clients === 1 ? "" : "s"} · {country.withCommission} with a commission
            </p>
          </div>
          {country.name === NOT_RECORDED ? null : (
            <table className="mt-4 w-full font-sans text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-text-light">
                  <th className="pb-2 font-medium">State</th>
                  <th className="pb-2 font-medium">Cities</th>
                  <th className="pb-2 text-right font-medium">Clients</th>
                  <th className="pb-2 text-right font-medium">With a commission</th>
                </tr>
              </thead>
              <tbody>
                {country.states.map((state) => (
                  <tr key={state.name} className="border-t border-sand align-top">
                    <td className="py-2 text-ink">{state.name}</td>
                    <td className="py-2 text-text-mid">
                      {state.cities.map((c) => `${c.name} (${c.clients})`).join(", ")}
                    </td>
                    <td className="py-2 text-right text-ink">{state.clients}</td>
                    <td className="py-2 text-right text-text-mid">{state.withCommission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
