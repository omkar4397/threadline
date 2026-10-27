"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteRow } from "@/lib/mutations";
import { errorMessage } from "@/lib/form";
import { formatMoney, totalOf } from "@/lib/expenses";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { addDays, diffDays, durationDays, formatLong, todayISO } from "@/lib/dates";
import { leadDaysFor } from "@/lib/scheduling";
import { STATUS_COLOR, TASK_STATUSES, TASK_STATUS_LABEL, VENDOR_TYPE_LABEL } from "@/lib/labels";
import type { Task, TaskContext } from "@/lib/types";
import { useTaskActions } from "./use-task-actions";
import type { TablesUpdate } from "./types";

export function TaskDetailPanel({ task, context, onClose }: { task: Task | null; context: TaskContext; onClose: () => void }) {
  return (
    <Sheet open={task !== null} onClose={onClose} title={task?.stage_name ?? "Task"}>
      {task ? <TaskEditor key={`${task.id}:${task.updated_at}`} task={task} context={context} onClose={onClose} /> : null}
    </Sheet>
  );
}

function TaskEditor({ task, context, onClose }: { task: Task; context: TaskContext; onClose: () => void }) {
  const { saveTask, setStatus } = useTaskActions(context.tasks);
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatusValue] = useState(task.status);
  const [start, setStart] = useState(task.start_date);
  const [end, setEnd] = useState(task.end_date);
  const [vendorId, setVendorId] = useState(task.vendor_id ?? "");
  const [designerId, setDesignerId] = useState(task.designer_id ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [saving, setSaving] = useState(false);

  const project = context.projects.find((p) => p.id === task.project_id);
  const client = context.clients.find((c) => c.id === project?.client_id);
  const vendor = context.vendors.find((v) => v.id === vendorId);
  const designer = context.designers.find((d) => d.id === designerId);
  const today = todayISO();

  const datesValid = Boolean(start && end) && diffDays(end, start) >= 0;
  const duration = datesValid ? durationDays(start, end) : null;
  // Only an assigned vendor's or designer's lead time is offered; stage days
  // are always set by hand.
  const suggestedLead = leadDaysFor(duration ?? 1, vendor, designer);
  const leadSource = [vendor, designer].filter((p) => p?.typical_lead_days).map((p) => p!.name).join(" / ") || null;
  const showLeadHint = datesValid && leadSource !== null && suggestedLead !== duration;

  const patch = useMemo(() => {
    const p: TablesUpdate = {};
    if (status !== task.status) p.status = status;
    if (start !== task.start_date) p.start_date = start;
    if (end !== task.end_date) p.end_date = end;
    if ((vendorId || null) !== task.vendor_id) p.vendor_id = vendorId || null;
    if ((designerId || null) !== task.designer_id) p.designer_id = designerId || null;
    if ((notes.trim() || null) !== task.notes) p.notes = notes.trim() || null;
    return p;
  }, [status, start, end, vendorId, designerId, notes, task]);
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setSaving(true);
    const ok = await saveTask(task, patch);
    setSaving(false);
    if (ok) onClose();
  }

  const linkedExpenses = (context.expenses ?? []).filter((e) => e.task_id === task.id);

  async function removeStage() {
    const ok = await confirm({
      title: `Remove ${task.stage_name}?`,
      message: `This removes the stage from ${project?.name ?? "the project"}, including its dates, assignments and notes.${
        linkedExpenses.length ? ` Its ${linkedExpenses.length} expense${linkedExpenses.length === 1 ? " stays" : "s stay"} on the project, no longer linked to a stage.` : ""
      }`,
      choices: [{ value: "remove", label: "Remove stage", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("tasks", task.id);
      toast(`${task.stage_name} removed`);
      router.refresh();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function markDone() {
    setSaving(true);
    if (dirty) {
      const ok = await saveTask(task, { ...patch, status: "done" });
      setSaving(false);
      if (ok) onClose();
    } else {
      await setStatus(task, "done");
      setSaving(false);
      onClose();
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-sm">
        {project ? (
          <Link href={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
            {project.name}
          </Link>
        ) : null}
        {client ? <span className="text-muted"> · {client.name}</span> : null}
        {project ? <p className="mt-0.5 text-muted">Delivery {formatLong(project.delivery_date)}</p> : null}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Status</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusValue(s)}
              aria-pressed={status === s}
              className={`min-h-11 rounded-lg px-2 text-sm font-medium ${status === s ? "bg-surface shadow-sm" : "text-stone-500"}`}
            >
              <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: STATUS_COLOR[s].bg }} />
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="End">
          <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <div className="-mt-3 space-y-2 text-xs">
        {duration ? <p className="text-muted">{duration} day{duration === 1 ? "" : "s"}</p> : <p className="text-risk">End date must be on or after the start date.</p>}
        {status === "not_started" && start && diffDays(start, today) < 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">The start date is already in the past.</p>
        ) : null}
        {status !== "done" && end && diffDays(end, today) < 0 ? (
          <p className="rounded-lg bg-risk-soft px-3 py-2 text-risk">This task is past its end date and isn’t done.</p>
        ) : null}
        {showLeadHint ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2 text-accent">
            <span>
              {leadSource}: {suggestedLead} day{suggestedLead === 1 ? "" : "s"}
            </span>
            <button type="button" className="min-h-9 font-medium underline" onClick={() => setEnd(addDays(start, suggestedLead - 1))}>
              Use this lead time
            </button>
          </div>
        ) : null}
      </div>

      <Field label="Vendor">
        <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">No vendor</option>
          {context.vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {VENDOR_TYPE_LABEL[v.type]}
              {v.typical_lead_days ? ` · ${v.typical_lead_days}d` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Designer">
        <Select value={designerId} onChange={(e) => setDesignerId(e.target.value)}>
          <option value="">No designer</option>
          {context.designers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.typical_lead_days ? ` · ${d.typical_lead_days}d` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>

      {linkedExpenses.length > 0 ? (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm">
          {formatMoney(totalOf(linkedExpenses))} spent on this stage ({linkedExpenses.length} expense{linkedExpenses.length === 1 ? "" : "s"}).
          {project ? (
            <>
              {" "}
              <Link href={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
                See expenses
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <button type="button" onClick={removeStage} className="min-h-11 text-sm font-medium text-risk hover:underline">
        Remove stage from project
      </button>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {task.status !== "done" ? (
          <Button onClick={markDone} disabled={saving || !datesValid} className="flex-1">
            ✓ Mark done
          </Button>
        ) : null}
        <Button variant="primary" onClick={save} disabled={saving || !dirty || !datesValid} className="flex-1">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
