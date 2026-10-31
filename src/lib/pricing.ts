import { inrPerUnit, type RateMap } from "@/lib/fx";
import type { Enum } from "@/lib/database.types";

export type PricingUnit = Enum<"pricing_unit">;
export type PricingDetail = Enum<"pricing_detail">;

export const PRICING_UNITS: PricingUnit[] = ["metre", "piece", "design", "shipment", "set", "kg", "flat"];

export const UNIT_LABEL: Record<PricingUnit, { one: string; many: string; per: string }> = {
  metre: { one: "metre", many: "metres", per: "per metre" },
  piece: { one: "piece", many: "pieces", per: "per piece" },
  design: { one: "design", many: "designs", per: "per design" },
  shipment: { one: "shipment", many: "shipments", per: "per shipment" },
  set: { one: "set", many: "sets", per: "per set" },
  kg: { one: "kg", many: "kg", per: "per kg" },
  flat: { one: "flat amount", many: "flat amount", per: "flat amount" },
};

export const DETAIL_LABEL: Record<PricingDetail, string> = {
  none: "No extra detail",
  text: "Free-text name",
  product: "Product list",
};

/** "40 metres", "3 designs", "1 piece"; flat amounts have no quantity. */
export function formatQuantity(quantity: number, unit: PricingUnit) {
  if (unit === "flat") return "Flat";
  const q = Number(quantity);
  const text = q.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${text} ${q === 1 ? UNIT_LABEL[unit].one : UNIT_LABEL[unit].many}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type LineLike = { quantity: number; unit: PricingUnit; vendor_rate: number; client_rate: number; client_currency: string };

export type LineFigures = {
  /** INR */
  vendorTotal: number;
  /** In the line's client currency */
  clientTotal: number;
  /** Client total in INR, or null when no rate is known for the currency */
  clientInr: number | null;
  /** INR */
  margin: number | null;
  /** Margin as a share of the client price, 0–1 (null when the client price is 0) */
  marginPct: number | null;
};

export function lineFigures(line: LineLike, rates: RateMap | null | undefined): LineFigures {
  const qty = line.unit === "flat" ? 1 : Number(line.quantity);
  const vendorTotal = round2(qty * Number(line.vendor_rate));
  const clientTotal = round2(qty * Number(line.client_rate));
  const rate = inrPerUnit(line.client_currency, rates);
  const clientInr = rate === null ? null : round2(clientTotal * rate);
  const margin = clientInr === null ? null : round2(clientInr - vendorTotal);
  const marginPct = margin === null || !clientInr ? null : margin / clientInr;
  return { vendorTotal, clientTotal, clientInr, margin, marginPct };
}

export type PricingSummary = {
  clientByCurrency: { currency: string; total: number }[];
  /** Sum in INR of what could be converted */
  clientInr: number;
  vendorTotal: number;
  serviceMargin: number;
  servicePct: number | null;
  fee: { amount: number; currency: string; inr: number | null } | null;
  earned: number;
  earnedPct: number | null;
  /** Currencies used without a known rate; their amounts are left out of INR totals */
  missingRates: string[];
};

export function pricingSummary(
  lines: LineLike[],
  fee: { amount: number | null; currency: string } | null,
  rates: RateMap | null | undefined,
): PricingSummary {
  const byCurrency = new Map<string, number>();
  const missing = new Set<string>();
  let clientInr = 0;
  let vendorTotal = 0;
  let serviceMargin = 0;

  for (const line of lines) {
    const f = lineFigures(line, rates);
    byCurrency.set(line.client_currency, round2((byCurrency.get(line.client_currency) ?? 0) + f.clientTotal));
    vendorTotal += f.vendorTotal;
    if (f.clientInr === null || f.margin === null) {
      missing.add(line.client_currency);
      continue;
    }
    clientInr += f.clientInr;
    serviceMargin += f.margin;
  }

  let feeSummary: PricingSummary["fee"] = null;
  if (fee && fee.amount && fee.amount > 0) {
    const rate = inrPerUnit(fee.currency, rates);
    if (rate === null) missing.add(fee.currency);
    feeSummary = { amount: Number(fee.amount), currency: fee.currency, inr: rate === null ? null : round2(Number(fee.amount) * rate) };
  }

  clientInr = round2(clientInr);
  serviceMargin = round2(serviceMargin);
  const feeInr = feeSummary?.inr ?? 0;
  const earned = round2(serviceMargin + feeInr);
  const billedInr = clientInr + feeInr;

  return {
    clientByCurrency: [...byCurrency.entries()].map(([currency, total]) => ({ currency, total })),
    clientInr,
    vendorTotal: round2(vendorTotal),
    serviceMargin,
    servicePct: clientInr > 0 ? serviceMargin / clientInr : null,
    fee: feeSummary,
    earned,
    earnedPct: billedInr > 0 ? earned / billedInr : null,
    missingRates: [...missing].sort(),
  };
}

export function formatPct(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return "–";
  return `${Math.round(pct * 100)}%`;
}

/** Currencies a project needs a rate for (everything but INR). */
export function foreignCurrencies(lines: { client_currency: string }[], fee: { amount: number | null; currency: string } | null) {
  const set = new Set(lines.map((l) => l.client_currency));
  if (fee?.amount) set.add(fee.currency);
  set.delete("INR");
  return [...set].sort();
}
