"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateRow } from "@/lib/mutations";
import { createClient } from "@/lib/supabase/client";
import { convert, describeRate, formatCurrency, type RateMap } from "@/lib/fx";
import { errorMessage } from "@/lib/form";
import { formatLong } from "@/lib/dates";
import type { Project } from "@/lib/types";
import { CurrencySelect } from "./currency-select";
import { ensureLockedRate } from "./rate-lock";
import { parseRate, RateField } from "./rate-field";

/** Consulting fee for the project, in any currency. */
export function FeeSheet({ open, onClose, project, locked, latest }: { open: boolean; onClose: () => void; project: Project; locked: RateMap; latest: RateMap | null }) {
  return (
    <Sheet open={open} onClose={onClose} title="Consulting fee">
      {open ? <FeeForm project={project} locked={locked} latest={latest} onClose={onClose} /> : null}
    </Sheet>
  );
}

function FeeForm({ project, locked, latest, onClose }: { project: Project; locked: RateMap; latest: RateMap | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(project.consulting_fee ? String(Number(project.consulting_fee)) : "");
  const [currency, setCurrency] = useState(project.consulting_fee_currency);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = amount.trim() === "" ? null : Number(amount.replace(/,/g, ""));
    if (value !== null && !(value >= 0)) return setError("Enter an amount of zero or more, or leave it empty.");
    setPending(true);
    setError(null);
    try {
      if (value) await ensureLockedRate({ projectId: project.id, currency, locked, latest, manualRate: parseRate(manual) });
      await updateRow("projects", project.id, { consulting_fee: value, consulting_fee_currency: currency });
      toast("Consulting fee saved");
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-muted">Your fee for coordinating this project, quoted to the client. It’s added to what you earn.</p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] gap-3">
        <Field label="Amount">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
        <Field label="Currency">
          <CurrencySelect value={currency} onChange={setCurrency} rates={latest} />
        </Field>
      </div>
      {amount ? <RateField currency={currency} locked={locked} latest={latest} manual={manual} onManualChange={setManual} /> : null}
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save fee"}
      </Button>
    </form>
  );
}

/** Edit one locked rate by hand, e.g. to match the bank's rate. */
export function RateSheet({ currency, onClose, projectId, locked, latest }: { currency: string | null; onClose: () => void; projectId: string; locked: RateMap; latest: RateMap | null }) {
  return (
    <Sheet open={currency !== null} onClose={onClose} title={currency ? `${currency} rate` : "Rate"}>
      {currency ? <RateForm key={currency} currency={currency} projectId={projectId} locked={locked} latest={latest} onClose={onClose} /> : null}
    </Sheet>
  );
}

function RateForm({ currency, projectId, locked, latest, onClose }: { currency: string; projectId: string; locked: RateMap; latest: RateMap | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(locked[currency] ? String(locked[currency]) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(rate: number, manual: boolean) {
    setPending(true);
    setError(null);
    try {
      const { error: e } = await createClient()
        .from("project_fx_rates")
        .upsert({ project_id: projectId, currency, inr_per_unit: rate, manual, locked_at: new Date().toISOString() });
      if (e) throw e;
      toast(`${currency} rate locked`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const rate = parseRate(value);
        if (!rate) return setError("Enter a rate above zero.");
        save(rate, true);
      }}
      className="space-y-4"
    >
      <Field label={`₹ for 1 ${currency}`} hint="All lines in this currency on this project use this rate.">
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      {latest?.[currency] ? <p className="text-sm text-muted">Today: {describeRate(currency, latest[currency])}</p> : null}
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        Lock this rate
      </Button>
      {latest?.[currency] ? (
        <Button className="w-full" onClick={() => save(latest[currency], false)} disabled={pending}>
          Use today’s rate
        </Button>
      ) : null}
    </form>
  );
}

/** Two-way converter using today's rates. */
export function Converter({ latest, fetchedAt, stale }: { latest: RateMap | null; fetchedAt: string | null; stale: boolean }) {
  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("SAR");
  const [direction, setDirection] = useState<"toInr" | "fromInr">("toInr");
  const value = Number(amount.replace(/,/g, ""));
  const from = direction === "toInr" ? currency : "INR";
  const to = direction === "toInr" ? "INR" : currency;
  const result = value > 0 ? convert(value, from, to, latest) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-32">
          <Input aria-label="Amount to convert" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {direction === "toInr" ? (
          <div className="w-52">
            <CurrencySelect value={currency} onChange={setCurrency} rates={latest} ariaLabel="From currency" />
          </div>
        ) : (
          <span className="px-2 text-sm font-semibold">INR</span>
        )}
        <button
          type="button"
          onClick={() => setDirection(direction === "toInr" ? "fromInr" : "toInr")}
          className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-lg shadow-soft hover:bg-stone-50"
          aria-label="Swap direction"
          title="Swap direction"
        >
          ⇄
        </button>
        {direction === "toInr" ? (
          <span className="px-2 text-sm font-semibold">INR</span>
        ) : (
          <div className="w-52">
            <CurrencySelect value={currency} onChange={setCurrency} rates={latest} ariaLabel="To currency" />
          </div>
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums" aria-live="polite">
        {result === null ? (latest ? "–" : "Rates unavailable right now") : `${formatCurrency(value, from)} = ${formatCurrency(result, to)}`}
      </p>
      <p className="text-xs text-muted">
        {fetchedAt ? `${stale ? "Last saved rates" : "Today’s rates"} from ${formatLong(fetchedAt.slice(0, 10))}. ` : ""}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline">
          Rates by ExchangeRate-API
        </a>
      </p>
    </div>
  );
}
