"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createProjectWithTasks } from "@/lib/mutations";
import { formatLong, formatRange, todayISO } from "@/lib/dates";
import { scheduleBackward, tasksStartingInPast } from "@/lib/scheduling";
import { errorMessage } from "@/lib/form";
import type { Stage } from "@/lib/types";

export function NewProjectSheet({ open, onClose, clientId, stages }: { open: boolean; onClose: () => void; clientId: string; stages: Stage[] }) {
  return (
    <Sheet open={open} onClose={onClose} title="New project">
      {open ? <NewProjectForm clientId={clientId} stages={stages} /> : null}
    </Sheet>
  );
}

function NewProjectForm({ clientId, stages }: { clientId: string; stages: Stage[] }) {
  const router = useRouter();
  const toast = useToast();
  const today = todayISO();
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const chosen = stages.filter((s) => selected[s.id]);
  const parsed = chosen.map((s) => ({ stage: s, days: Number.parseInt(days[s.id] ?? "", 10) }));
  const missingDays = parsed.filter((p) => !Number.isInteger(p.days) || p.days < 1 || p.days > 365);
  const totalDays = parsed.reduce((n, p) => n + (Number.isInteger(p.days) && p.days > 0 ? p.days : 0), 0);

  // Stages keep their order from Settings; the schedule runs backward from
  // the delivery date using the days entered here.
  const plan =
    delivery && chosen.length > 0 && missingDays.length === 0
      ? scheduleBackward(
          parsed.map((p) => ({ name: p.stage.name, sort_order: p.stage.sort_order, default_lead_days: p.days })),
          delivery,
        )
      : [];
  const late = tasksStartingInPast(plan, today);
  const allSelected = stages.length > 0 && chosen.length === stages.length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.length === 0) return setError("Select at least one stage.");
    if (missingDays.length > 0) return setError(`Enter the number of days (1–365) for: ${missingDays.map((p) => p.stage.name).join(", ")}.`);
    setPending(true);
    setError(null);
    try {
      const id = await createProjectWithTasks({
        clientId,
        name: name.trim(),
        deliveryDate: delivery,
        notes: notes.trim() || null,
        tasks: plan.map(({ stage_name, sort_order, start_date, end_date }) => ({ stage_name, sort_order, start_date, end_date })),
      });
      toast(`Project created with ${plan.length} stage${plan.length === 1 ? "" : "s"}`);
      router.push(`/projects/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Project name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Spring 2027 resort collection" />
      </Field>
      <Field label="Delivery date">
        <Input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} required />
      </Field>

      <fieldset>
        <div className="mb-2 flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">Stages and days</legend>
          {stages.length > 0 ? (
            <button
              type="button"
              className="min-h-9 text-sm font-medium text-accent"
              onClick={() => setSelected(allSelected ? {} : Object.fromEntries(stages.map((s) => [s.id, true])))}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          ) : null}
        </div>
        {stages.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">You have no stages yet. Add them in Settings first.</p>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface shadow-soft">
            {stages.map((s) => {
              const on = Boolean(selected[s.id]);
              const planned = plan.find((t) => t.sort_order === s.sort_order && t.stage_name === s.name);
              return (
                <li key={s.id} className="flex items-center gap-3 px-3 py-1.5">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setSelected((cur) => ({ ...cur, [s.id]: e.target.checked }))}
                      className="size-5 shrink-0 accent-(--color-accent)"
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${on ? "font-medium" : "text-muted"}`}>{s.name}</span>
                      {planned ? (
                        <span className={`block text-xs ${late.includes(planned) ? "text-amber-700" : "text-muted"}`}>{formatRange(planned.start_date, planned.end_date)}</span>
                      ) : null}
                    </span>
                  </label>
                  {on ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Input
                        aria-label={`Days for ${s.name}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={365}
                        required
                        value={days[s.id] ?? ""}
                        onChange={(e) => setDays((cur) => ({ ...cur, [s.id]: e.target.value }))}
                        className="w-20 text-center"
                      />
                      <span className="text-xs text-muted">days</span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {chosen.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            {chosen.length} stage{chosen.length === 1 ? "" : "s"} · {totalDays} day{totalDays === 1 ? "" : "s"} in total
            {plan.length > 0 ? ` · starts ${formatLong(plan[0].start_date)}` : delivery ? " · enter days for every selected stage to see the dates" : " · pick a delivery date to see the dates"}
          </p>
        ) : null}
        {late.length > 0 ? (
          <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {late.length} stage{late.length === 1 ? " starts" : "s start"} in the past. Work would have needed to start on {formatLong(plan[0].start_date)}. You can still create the project and adjust dates afterwards.
          </p>
        ) : null}
      </fieldset>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || !name.trim() || !delivery || plan.length === 0}>
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
