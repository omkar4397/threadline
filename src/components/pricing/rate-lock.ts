"use client";

import { createClient } from "@/lib/supabase/client";
import type { RateMap } from "@/lib/fx";

/**
 * Makes sure the project has a locked rate for `currency`. Uses `manualRate`
 * when given, otherwise today's rate. Does nothing for INR or when a rate is
 * already locked. Throws when no rate is available at all.
 */
export async function ensureLockedRate(args: {
  projectId: string;
  currency: string;
  locked: RateMap;
  latest: RateMap | null;
  manualRate?: number | null;
}) {
  const { projectId, currency, locked, latest, manualRate } = args;
  if (currency === "INR" || locked[currency]) return;
  const rate = manualRate ?? latest?.[currency] ?? null;
  if (!rate || !(rate > 0)) throw new Error(`No exchange rate for ${currency} yet. Enter one to continue.`);
  const { error } = await createClient()
    .from("project_fx_rates")
    .upsert({ project_id: projectId, currency, inr_per_unit: rate, manual: Boolean(manualRate), locked_at: new Date().toISOString() });
  if (error) throw error;
}
