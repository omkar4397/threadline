"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/form";
import type { Stage } from "@/lib/types";

type Draft = { key: string; id?: string; name: string; lead: string };

export function StagesEditor({ stages }: { stages: Stage[] }) {
  const router = useRouter();
  const toast = useToast();
  const initial = stages.map((s) => ({ key: s.id, id: s.id, name: s.name, lead: String(s.default_lead_days) }));
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = JSON.stringify(drafts.map(({ id, name, lead }) => [id, name, lead])) !== JSON.stringify(initial.map(({ id, name, lead }) => [id, name, lead]));
  const total = drafts.reduce((n, d) => n + (Number.parseInt(d.lead, 10) || 0), 0);

  const update = (key: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (index: number, by: -1 | 1) =>
    setDrafts((ds) => {
      const next = [...ds];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  async function save() {
    setError(null);
    for (const d of drafts) {
      const lead = Number.parseInt(d.lead, 10);
      if (!d.name.trim()) return setError("Every stage needs a name.");
      if (!Number.isInteger(lead) || lead < 1 || lead > 365) return setError(`“${d.name}” needs a lead time between 1 and 365 days.`);
    }
    if (drafts.length === 0) return setError("Keep at least one stage.");

    setPending(true);
    try {
      const supabase = createClient();
      const removed = stages.filter((s) => !drafts.some((d) => d.id === s.id)).map((s) => s.id);
      if (removed.length) {
        const { error: e } = await supabase.from("stage_templates").delete().in("id", removed);
        if (e) throw e;
      }
      const results = await Promise.all(
        drafts.map((d, i) => {
          const values = { name: d.name.trim(), default_lead_days: Number.parseInt(d.lead, 10), sort_order: i + 1 };
          return d.id ? supabase.from("stage_templates").update(values).eq("id", d.id) : supabase.from("stage_templates").insert(values);
        }),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      toast("Stages saved");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card>
        <ol>
          {drafts.map((d, i) => (
            <li key={d.key} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0">
              <span className="w-5 shrink-0 text-center text-sm text-muted">{i + 1}</span>
              <Input aria-label={`Stage ${i + 1} name`} value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} className="min-w-0 flex-1" />
              <div className="flex shrink-0 items-center gap-1">
                <Input
                  aria-label={`Stage ${i + 1} lead time in days`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={d.lead}
                  onChange={(e) => update(d.key, { lead: e.target.value })}
                  className="w-16 text-center sm:w-20"
                />
                <span className="hidden text-xs text-muted sm:inline">days</span>
              </div>
              <div className="flex shrink-0">
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </IconButton>
                <IconButton label="Move down" disabled={i === drafts.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </IconButton>
                <IconButton label="Remove stage" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>
                  ×
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => setDrafts((ds) => [...ds, { key: crypto.randomUUID(), name: "", lead: "5" }])}>+ Add stage</Button>
        <span className="text-sm text-muted">Total: {total} days</span>
      </div>
      <div className="mt-3">
        <FormError message={error} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save stages"}
        </Button>
        {dirty ? (
          <Button variant="ghost" onClick={() => setDrafts(initial)} disabled={pending}>
            Discard changes
          </Button>
        ) : null}
      </div>
    </>
  );
}

function IconButton({ label, children, ...props }: { label: string; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} className="flex size-11 items-center justify-center rounded-lg text-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}
