"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createProjectWithTasks } from "@/lib/mutations";
import { addDays, formatLong, formatRange, todayISO } from "@/lib/dates";
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
  const totalLead = stages.reduce((n, s) => n + s.default_lead_days, 0);
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState(addDays(today, totalLead + 7));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const plan = delivery ? scheduleBackward(stages, delivery) : [];
  const late = tasksStartingInPast(plan, today);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stages.length === 0) {
      setError("Add stages in Settings first.");
      return;
    }
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
      toast(`Project created with ${plan.length} tasks`);
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
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {plan.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Generated schedule</p>
          {late.length > 0 ? (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {late.length} stage{late.length === 1 ? " starts" : "s start"} in the past. The schedule needs {totalLead} days, so work should have started on {formatLong(plan[0].start_date)}. You can still create it and adjust dates afterwards.
            </p>
          ) : null}
          <ol className="divide-y divide-line rounded-xl border border-line text-sm">
            {plan.map((t) => (
              <li key={t.sort_order} className={`flex justify-between gap-3 px-3 py-2 ${late.includes(t) ? "text-amber-800" : ""}`}>
                <span className="truncate">{t.stage_name}</span>
                <span className="shrink-0 text-muted">
                  {formatRange(t.start_date, t.end_date)} · {t.lead_days}d
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">Lead times come from the stage defaults in Settings. Assigning a vendor or designer later lets you use their lead time.</p>
        </div>
      ) : null}

      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || !name.trim() || !delivery}>
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
