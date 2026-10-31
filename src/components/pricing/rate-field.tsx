"use client";

import { Field, Input } from "@/components/ui/field";
import { describeRate, type RateMap } from "@/lib/fx";

/**
 * Explains which rate a foreign currency will use on this project, and asks
 * for one when no rate is locked and none could be fetched today.
 */
export function RateField({
  currency,
  locked,
  latest,
  manual,
  onManualChange,
}: {
  currency: string;
  locked: RateMap;
  latest: RateMap | null;
  manual: string;
  onManualChange: (value: string) => void;
}) {
  if (currency === "INR") return null;
  if (locked[currency]) {
    return <p className="rounded-2xl bg-stone-100 px-4 py-2.5 text-sm">Uses this project’s locked rate: {describeRate(currency, locked[currency])}</p>;
  }
  if (latest?.[currency]) {
    return <p className="rounded-2xl bg-stone-100 px-4 py-2.5 text-sm">Today’s rate will be locked for this project: {describeRate(currency, latest[currency])}</p>;
  }
  return (
    <Field label={`Rate: ₹ for 1 ${currency}`} hint="No rate could be fetched today, so enter the rate to lock for this project.">
      <Input inputMode="decimal" value={manual} onChange={(e) => onManualChange(e.target.value)} placeholder="e.g. 22.40" required />
    </Field>
  );
}

export function parseRate(value: string) {
  const n = Number(value.replace(/[^\d.]/g, ""));
  return n > 0 && Number.isFinite(n) ? n : null;
}
