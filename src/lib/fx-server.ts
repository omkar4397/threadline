import "server-only";
import { parseCurrencyApi, parseExchangeRateApi, type RateMap } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export type LatestRates = {
  rates: RateMap;
  source: string;
  fetchedAt: string;
  /** True when today's fetch failed and these are the last saved rates. */
  stale: boolean;
};

// Free sources, no account or key. Rates change once a day, so we fetch at
// most every 12 hours per account and keep the last good copy in fx_latest.
const SOURCES: { name: string; url: string; parse: (json: unknown) => RateMap | null }[] = [
  { name: "ExchangeRate-API", url: "https://open.er-api.com/v6/latest/INR", parse: parseExchangeRateApi },
  { name: "currency-api", url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json", parse: parseCurrencyApi },
  { name: "currency-api", url: "https://latest.currency-api.pages.dev/v1/currencies/inr.json", parse: parseCurrencyApi },
];

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

async function fetchFresh(): Promise<{ rates: RateMap; source: string } | null> {
  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, { cache: "no-store", signal: AbortSignal.timeout(3500) });
      if (!res.ok) continue;
      const rates = source.parse(await res.json());
      if (rates) return { rates, source: source.name };
    } catch {
      // Try the next source.
    }
  }
  return null;
}

/** Today's rates for the signed-in account, refreshing them when older than 12 hours. */
export async function getLatestRates(): Promise<LatestRates | null> {
  const supabase = await createClient();
  const { data: saved } = await supabase.from("fx_latest").select("*").maybeSingle();
  const savedRates = saved ? (saved.rates as RateMap) : null;

  if (saved && Date.now() - new Date(saved.fetched_at).getTime() < MAX_AGE_MS) {
    return { rates: savedRates!, source: saved.source, fetchedAt: saved.fetched_at, stale: false };
  }

  const fresh = await fetchFresh();
  if (fresh) {
    const fetchedAt = new Date().toISOString();
    await supabase.from("fx_latest").upsert({ rates: fresh.rates, source: fresh.source, fetched_at: fetchedAt });
    return { ...fresh, fetchedAt, stale: false };
  }

  return saved ? { rates: savedRates!, source: saved.source, fetchedAt: saved.fetched_at, stale: true } : null;
}
