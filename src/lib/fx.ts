// Currency helpers. Rates are stored as INR per 1 unit of a currency
// ({ USD: 84.1, SAR: 22.4 }); INR itself is always 1 and never stored.

export type RateMap = Record<string, number>;

/** Shown first in every currency picker, in this order. */
export const PINNED_CURRENCIES = ["INR", "USD", "SAR", "AED", "EUR", "GBP", "SEK"];

const CODE = /^[A-Z]{3}$/;

export function inrPerUnit(currency: string, rates: RateMap | null | undefined): number | null {
  if (currency === "INR") return 1;
  const rate = rates?.[currency];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

/** Pinned currencies first, then every other known code alphabetically. */
export function currencyOptions(known: Iterable<string>): string[] {
  const rest = [...new Set(known)].filter((c) => CODE.test(c) && !PINNED_CURRENCIES.includes(c)).sort();
  return [...PINNED_CURRENCIES, ...rest];
}

let displayNames: Intl.DisplayNames | null = null;
export function currencyName(code: string) {
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "currency" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const formatters = new Map<string, Intl.NumberFormat>();
/** ₹1,500 / SAR 1,200 / $300.50: whole amounts without decimals, others with two. */
export function formatCurrency(amount: number, currency: string) {
  const whole = Number.isInteger(Math.round(amount * 100) / 100);
  const key = `${currency}:${whole}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
    formatters.set(key, f);
  }
  return f.format(amount);
}

/** "1 SAR = ₹22.40" */
export function describeRate(currency: string, rate: number) {
  return `1 ${currency} = ₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function invertRates(perInr: Record<string, unknown>, upperCase: boolean): RateMap {
  const out: RateMap = {};
  for (const [rawCode, value] of Object.entries(perInr)) {
    const code = upperCase ? rawCode.toUpperCase() : rawCode;
    if (!CODE.test(code) || code === "INR" || typeof value !== "number" || !(value > 0)) continue;
    out[code] = Number((1 / value).toPrecision(10));
  }
  return out;
}

/** ExchangeRate-API open access, base INR: { result: "success", rates: { USD: 0.0119, ... } } */
export function parseExchangeRateApi(json: unknown): RateMap | null {
  if (!json || typeof json !== "object") return null;
  const data = json as { result?: string; base_code?: string; rates?: Record<string, unknown> };
  if (data.result !== "success" || data.base_code !== "INR" || !data.rates) return null;
  const rates = invertRates(data.rates, false);
  return Object.keys(rates).length > 0 ? rates : null;
}

/** fawazahmed0 currency-api, base INR: { date, inr: { usd: 0.0119, ... } } (lower-case codes, includes non-ISO tokens). */
export function parseCurrencyApi(json: unknown): RateMap | null {
  if (!json || typeof json !== "object") return null;
  const data = json as { inr?: Record<string, unknown> };
  if (!data.inr || typeof data.inr !== "object") return null;
  const rates = invertRates(data.inr, true);
  return Object.keys(rates).length > 0 ? rates : null;
}

/** Converts between any two currencies through INR; null when a rate is missing. */
export function convert(amount: number, from: string, to: string, rates: RateMap | null | undefined): number | null {
  const fromRate = inrPerUnit(from, rates);
  const toRate = inrPerUnit(to, rates);
  if (fromRate === null || toRate === null) return null;
  return (amount * fromRate) / toRate;
}
