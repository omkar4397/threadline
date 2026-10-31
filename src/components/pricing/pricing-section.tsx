"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { describeRate, formatCurrency, type RateMap } from "@/lib/fx";
import { foreignCurrencies, formatPct, formatQuantity, lineFigures, pricingSummary, UNIT_LABEL } from "@/lib/pricing";
import { formatShort } from "@/lib/dates";
import { errorMessage } from "@/lib/form";
import type { Designer, PricingItemType, PricingLine, PricingProduct, Project, ProjectFxRate, Vendor } from "@/lib/types";
import { PricingLineSheet } from "./pricing-line-sheet";
import { Converter, FeeSheet, RateSheet } from "./pricing-extras";

export type LatestRatesProp = { rates: RateMap; fetchedAt: string; stale: boolean } | null;

export function PricingSection({
  project,
  lines,
  itemTypes,
  products,
  lockedRates,
  latest,
  fabricNames,
  vendors,
  designers,
}: {
  project: Project;
  lines: PricingLine[];
  itemTypes: PricingItemType[];
  products: PricingProduct[];
  lockedRates: ProjectFxRate[];
  latest: LatestRatesProp;
  fabricNames: string[];
  vendors: Vendor[];
  designers: Designer[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<PricingLine | null>(null);
  const [adding, setAdding] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [rateCurrency, setRateCurrency] = useState<string | null>(null);
  const [showConverter, setShowConverter] = useState(false);

  const locked: RateMap = Object.fromEntries(lockedRates.map((r) => [r.currency, Number(r.inr_per_unit)]));
  const latestRates = latest?.rates ?? null;
  const fee = { amount: project.consulting_fee === null ? null : Number(project.consulting_fee), currency: project.consulting_fee_currency };
  const summary = pricingSummary(lines, fee, locked);
  const needed = foreignCurrencies(lines, fee);
  const today = latestRates ? pricingSummary(lines, fee, { ...locked, ...pickRates(latestRates, needed) }) : null;
  const todayDiff = today && needed.length > 0 && today.missingRates.length === 0 ? Math.round((today.earned - summary.earned) * 100) / 100 : null;
  const sorted = [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const defaultCurrency = sorted.at(-1)?.client_currency ?? (fee.amount ? fee.currency : "INR");

  const typeName = (id: string) => itemTypes.find((t) => t.id === id)?.name ?? "Item";
  const productName = (id: string | null) => (id ? products.find((p) => p.id === id)?.name : undefined);
  const providerName = (l: PricingLine) => vendors.find((v) => v.id === l.vendor_id)?.name ?? designers.find((d) => d.id === l.designer_id)?.name;

  async function updateAllRates() {
    if (!latestRates) return;
    const usable = needed.filter((c) => latestRates[c]);
    const ok = await confirm({
      title: "Update to today’s rates?",
      message: (
        <>
          {usable.map((c) => describeRate(c, latestRates[c])).join(" · ")}. All lines and the consulting fee on this project will use these rates
          {lockedRates.some((r) => r.manual) ? ", replacing rates you entered by hand" : ""}.
        </>
      ),
      choices: [{ value: "update", label: "Update rates", variant: "primary" }],
    });
    if (!ok) return;
    try {
      const now = new Date().toISOString();
      const { error } = await createClient()
        .from("project_fx_rates")
        .upsert(usable.map((currency) => ({ project_id: project.id, currency, inr_per_unit: latestRates[currency], manual: false, locked_at: now })));
      if (error) throw error;
      toast("Rates updated");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Pricing</h2>
          <p className="text-sm text-muted">What you quote the client vs what vendors agreed with you. Only you can see this.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowConverter((v) => !v)} aria-expanded={showConverter}>
            Converter
          </Button>
          <Button variant="primary" onClick={() => setAdding(true)}>
            + Add line
          </Button>
        </div>
      </div>

      {showConverter ? (
        <Card className="mb-4 px-4 py-4">
          <Converter latest={latestRates} fetchedAt={latest?.fetchedAt ?? null} stale={latest?.stale ?? false} />
        </Card>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Quoted to client">
          {summary.clientByCurrency.length === 0 && !summary.fee ? (
            <span className="text-muted">–</span>
          ) : (
            <>
              {mergeFee(summary).map((c) => (
                <span key={c.currency} className="block">
                  {formatCurrency(c.total, c.currency)}
                </span>
              ))}
              {needed.length > 0 ? <span className="block text-xs font-normal text-muted">≈ {formatCurrency(summary.clientInr + (summary.fee?.inr ?? 0), "INR")}</span> : null}
            </>
          )}
        </Tile>
        <Tile label="Vendor total">{formatCurrency(summary.vendorTotal, "INR")}</Tile>
        <Tile label="Margin on services" sub={formatPct(summary.servicePct)} negative={summary.serviceMargin < 0}>
          {formatCurrency(summary.serviceMargin, "INR")}
        </Tile>
        <Tile
          label="Consulting fee"
          sub={summary.fee && summary.fee.currency !== "INR" && summary.fee.inr !== null ? `≈ ${formatCurrency(summary.fee.inr, "INR")}` : undefined}
          action={
            <button type="button" onClick={() => setFeeOpen(true)} className="min-h-9 text-xs font-semibold text-accent hover:underline">
              {summary.fee ? "Edit" : "Add"}
            </button>
          }
        >
          {summary.fee ? formatCurrency(summary.fee.amount, summary.fee.currency) : <span className="text-muted">–</span>}
        </Tile>
        <Tile label="You earn" sub={formatPct(summary.earnedPct)} highlight negative={summary.earned < 0} className="col-span-2 lg:col-span-1">
          {formatCurrency(summary.earned, "INR")}
        </Tile>
      </div>

      {needed.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Locked rates:</span>
          {needed.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setRateCurrency(c)}
              className={`min-h-9 rounded-full px-3 text-xs font-semibold shadow-soft hover:bg-stone-50 ${locked[c] ? "bg-surface" : "bg-risk-soft text-risk"}`}
              title="Edit rate"
            >
              {locked[c] ? `${describeRate(c, locked[c])} · ${formatShort(lockedRates.find((r) => r.currency === c)!.locked_at.slice(0, 10))}${lockedRates.find((r) => r.currency === c)?.manual ? " · your rate" : ""}` : `${c}: no rate, tap to set`}
            </button>
          ))}
          {latestRates && needed.some((c) => latestRates[c] && latestRates[c] !== locked[c]) ? (
            <button type="button" onClick={updateAllRates} className="min-h-9 px-2 text-xs font-semibold text-accent hover:underline">
              Update to today’s rates
            </button>
          ) : null}
          {todayDiff !== null && Math.abs(todayDiff) >= 1 ? (
            <span className={`text-xs ${todayDiff < 0 ? "text-risk" : "text-muted"}`}>
              At today’s rates you’d earn {formatCurrency(today!.earned, "INR")} ({todayDiff > 0 ? "+" : "−"}
              {formatCurrency(Math.abs(todayDiff), "INR")})
            </span>
          ) : null}
        </div>
      ) : null}
      {summary.missingRates.length > 0 ? (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          No rate for {summary.missingRates.join(", ")}, so those amounts are left out of the INR totals. Tap the rate above to set one.
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-muted">
          <p>No pricing yet. Add a line for each fabric, design, sample, production run or courier you’re quoting.</p>
          <Button variant="primary" className="mt-4" onClick={() => setAdding(true)}>
            + Add line
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] gap-3 border-b border-line px-4 py-2 text-xs text-muted md:grid">
            <span>Item</span>
            <span>Quantity</span>
            <span className="text-right">Vendor price</span>
            <span className="text-right">Client price</span>
            <span className="text-right">Margin</span>
          </div>
          <ul>
            {sorted.map((l) => {
              const f = lineFigures(l, locked);
              const name = [typeName(l.item_type_id), productName(l.product_id) ?? l.detail].filter(Boolean).join(" · ");
              const per = l.unit === "flat" ? "" : ` / ${UNIT_LABEL[l.unit].one}`;
              const provider = providerName(l);
              return (
                <li key={l.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setEditing(l)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-stone-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] md:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      {provider ? <span className="block truncate text-xs text-muted">{provider}</span> : null}
                      <span className="block text-xs text-muted md:hidden">{formatQuantity(Number(l.quantity), l.unit)}</span>
                    </span>
                    <span className="hidden text-sm md:block">{formatQuantity(Number(l.quantity), l.unit)}</span>
                    <span className="hidden text-right text-sm tabular-nums md:block">
                      {formatCurrency(Number(l.vendor_rate), "INR")}
                      {per}
                      {l.unit === "flat" ? null : <span className="block text-xs text-muted">{formatCurrency(f.vendorTotal, "INR")}</span>}
                    </span>
                    <span className="hidden text-right text-sm tabular-nums md:block">
                      {formatCurrency(Number(l.client_rate), l.client_currency)}
                      {per}
                      {l.unit !== "flat" || l.client_currency !== "INR" ? (
                        <span className="block text-xs text-muted">
                          {l.unit === "flat" ? "" : formatCurrency(f.clientTotal, l.client_currency)}
                          {l.client_currency !== "INR" && f.clientInr !== null ? ` ≈ ${formatCurrency(f.clientInr, "INR")}` : ""}
                        </span>
                      ) : null}
                    </span>
                    <span className={`row-span-2 self-center text-right text-sm font-semibold tabular-nums md:row-span-1 ${f.margin !== null && f.margin < 0 ? "text-risk" : ""}`}>
                      {f.margin === null ? "–" : formatCurrency(f.margin, "INR")}
                      <span className="block text-xs font-normal text-muted">{formatPct(f.marginPct)}</span>
                    </span>
                    <span className="text-xs text-muted tabular-nums md:hidden">
                      Vendor {formatCurrency(f.vendorTotal, "INR")} · Client {formatCurrency(f.clientTotal, l.client_currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <PricingLineSheet
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        projectId={project.id}
        line={editing ?? undefined}
        defaultCurrency={defaultCurrency}
        itemTypes={itemTypes}
        products={products}
        fabricNames={fabricNames}
        locked={locked}
        latest={latestRates}
        vendors={vendors}
        designers={designers}
      />
      <FeeSheet open={feeOpen} onClose={() => setFeeOpen(false)} project={project} locked={locked} latest={latestRates} />
      <RateSheet currency={rateCurrency} onClose={() => setRateCurrency(null)} projectId={project.id} locked={locked} latest={latestRates} />
    </section>
  );
}

function pickRates(rates: RateMap, currencies: string[]): RateMap {
  return Object.fromEntries(currencies.filter((c) => rates[c]).map((c) => [c, rates[c]]));
}

/** Client totals per currency, including the consulting fee. */
function mergeFee(summary: ReturnType<typeof pricingSummary>) {
  const map = new Map(summary.clientByCurrency.map((c) => [c.currency, c.total]));
  if (summary.fee) map.set(summary.fee.currency, Math.round(((map.get(summary.fee.currency) ?? 0) + summary.fee.amount) * 100) / 100);
  return [...map.entries()].map(([currency, total]) => ({ currency, total }));
}

function Tile({
  label,
  sub,
  action,
  highlight,
  negative,
  className = "",
  children,
}: {
  className?: string;
  label: string;
  sub?: string;
  action?: React.ReactNode;
  highlight?: boolean;
  negative?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-3xl px-4 py-3 shadow-soft ${highlight ? "bg-accent-soft" : "bg-surface"} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        {action}
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${negative ? "text-risk" : ""}`}>{children}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
