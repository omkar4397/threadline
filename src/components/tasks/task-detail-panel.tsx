"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { deleteRow } from "@/lib/mutations";
import { errorMessage } from "@/lib/form";
import { formatMoney, totalOf } from "@/lib/expenses";
import { addDays, diffDays, durationDays, formatLong, todayISO } from "@/lib/dates";
import { assigneeColumns, assigneeKey, suggestedLeadDays } from "@/lib/scheduling";
import { STATUS_COLOR, TASK_STATUSES, TASK_STATUS_LABEL, VENDOR_TYPE_LABEL } from "@/lib/labels";
import type { Task, TaskContext } from "@/lib/types";
import { useTaskActions } from "./use-task-actions";
import type { TablesUpdate } from "./types";

export type NewTaskDraft = { kind: "task" | "milestone"; projectId?: string; start?: string };

/**
 * Add or edit a task or milestone. Pass `task` to edit, or `draft` to create
 * (with a fixed project, or a project picker when `draft.projectId` is empty).
 */
export function TaskDetailPanel({
  task,
  draft = null,
  context,
  onClose,
}: {
  task: Task | null;
  draft?: NewTaskDraft | null;
  context: TaskContext;
  onClose: () => void;
}) {
  const title = task ? task.title : draft?.kind === "milestone" ? "New milestone" : "New task";
  const open = task !== null || draft !== null;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open ? <TaskEditor key={task ? `${task.id}:${task.updated_at}` : `new:${draft?.kind}`} task={task} draft={draft} context={context} onClose={onClose} /> : null}
    </Sheet>
  );
}

function TaskEditor({ task, draft, context, onClose }: { task: Task | null; draft: NewTaskDraft | null; context: TaskContext; onClose: () => void }) {
  const { saveTask, createTask, setStatus } = useTaskActions();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const today = todayISO();

  const openProjects = context.projects.filter((p) => p.status !== "completed");
  const [projectId, setProjectId] = useState(task?.project_id ?? draft?.projectId ?? openProjects[0]?.id ?? "");
  const [kind, setKind] = useState<"task" | "milestone">(task?.kind ?? draft?.kind ?? "task");
  const [title, setTitle] = useState(task?.title ?? "");
  const [status, setStatusValue] = useState(task?.status ?? "not_started");
  const [start, setStart] = useState(task?.start_date ?? draft?.start ?? today);
  const [end, setEnd] = useState(task?.end_date ?? draft?.start ?? today);
  const [assignee, setAssignee] = useState<string>(task ? assigneeKey(task) : "none");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const project = context.projects.find((p) => p.id === projectId);
  const client = context.clients.find((c) => c.id === project?.client_id);
  const vendor = assignee.startsWith("v:") ? context.vendors.find((v) => v.id === assignee.slice(2)) : undefined;
  const designer = assignee.startsWith("d:") ? context.designers.find((d) => d.id === assignee.slice(2)) : undefined;
  const isMilestone = kind === "milestone";
  const effectiveEnd = isMilestone ? start : end;
  const datesValid = Boolean(start && effectiveEnd) && diffDays(effectiveEnd, start) >= 0;
  const duration = datesValid ? durationDays(start, effectiveEnd) : null;
  const lead = isMilestone ? null : suggestedLeadDays(vendor, designer);
  const showLeadHint = lead !== null && datesValid && lead !== duration;
  const linkedExpenses = task ? (context.expenses ?? []).filter((e) => e.task_id === task.id) : [];

  const values = useMemo(
    () => ({
      project_id: projectId,
      title: title.trim(),
      kind,
      start_date: start,
      end_date: effectiveEnd,
      status,
      notes: notes.trim() || null,
      ...assigneeColumns(assignee),
    }),
    [projectId, title, kind, start, effectiveEnd, status, notes, assignee],
  );

  const patch = useMemo(() => {
    if (!task) return {};
    const p: TablesUpdate = {};
    for (const [k, v] of Object.entries(values) as [keyof typeof values, unknown][]) {
      if ((task as Record<string, unknown>)[k] !== v) (p as Record<string, unknown>)[k] = v;
    }
    return p;
  }, [task, values]);
  const dirty = !task || Object.keys(patch).length > 0;

  async function save(extra: TablesUpdate = {}) {
    if (!values.title) return setError("Give it a title.");
    if (!projectId) return setError("Choose a project.");
    if (!datesValid) return setError("The end date can’t be before the start date.");
    setError(null);
    setSaving(true);
    const ok = task ? await saveTask(task, { ...patch, ...extra }) : await createTask({ ...values, ...extra });
    setSaving(false);
    if (ok) onClose();
  }

  async function markDone() {
    if (!task) return;
    if (Object.keys(patch).length > 0) return save({ status: "done" });
    setSaving(true);
    await setStatus(task, "done");
    setSaving(false);
    onClose();
  }

  async function remove() {
    if (!task) return;
    const ok = await confirm({
      title: `Delete “${task.title}”?`,
      message: `This removes it from ${project?.name ?? "the project"}.${
        linkedExpenses.length ? ` Its ${linkedExpenses.length} expense${linkedExpenses.length === 1 ? " stays" : "s stay"} on the project, no longer linked to a task.` : ""
      }`,
      choices: [{ value: "delete", label: "Delete", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("tasks", task.id);
      toast("Deleted");
      router.refresh();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5"
    >
      {task || draft?.projectId ? (
        <div className="text-sm">
          {project ? (
            <Link href={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
              {project.name}
            </Link>
          ) : null}
          {client ? <span className="text-muted"> · {client.name}</span> : null}
          {project ? <p className="mt-0.5 text-muted">Delivery {formatLong(project.delivery_date)}</p> : null}
        </div>
      ) : (
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            {openProjects.length === 0 ? <option value="">No open projects</option> : null}
            {openProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {context.clients.find((c) => c.id === p.client_id)?.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div role="group" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-full bg-accent-soft/70 p-1">
        {(["task", "milestone"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-10 rounded-full text-sm ${kind === k ? "bg-surface font-semibold shadow-soft" : "text-stone-500"}`}
          >
            {k === "task" ? "Task" : "Milestone"}
          </button>
        ))}
      </div>

      <Field label="Title" hint={isMilestone ? "A single-date event, e.g. client review meeting." : "Pick a common name or type your own."}>
        <Combobox value={title} onChange={setTitle} options={context.taskNames.map((n) => n.name)} maxLength={120} required autoFocus={!task} placeholder={isMilestone ? "e.g. Client review meeting" : "e.g. Research, Sampling"} />
      </Field>

      {isMilestone ? (
        <Field label="Date">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="date"
              value={start}
              onChange={(e) => {
                const next = e.target.value;
                // Keep the length when moving the start forward past the end.
                if (next && end && diffDays(end, next) < 0) setEnd(next);
                setStart(next);
              }}
              required
            />
          </Field>
          <Field label="End">
            <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
      )}
      <div className="-mt-3 space-y-2 text-xs">
        {!isMilestone ? duration ? <p className="text-muted">{duration} day{duration === 1 ? "" : "s"}</p> : <p className="text-risk">End date must be on or after the start date.</p> : null}
        {status !== "done" && effectiveEnd && diffDays(effectiveEnd, today) < 0 ? (
          <p className="rounded-2xl bg-risk-soft px-3 py-2 text-risk">{isMilestone ? "This date has passed and it isn’t marked done." : "This task is past its end date and isn’t done."}</p>
        ) : null}
        {project && effectiveEnd && diffDays(effectiveEnd, project.delivery_date) > 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-800">This is after the project’s delivery date ({formatLong(project.delivery_date)}).</p>
        ) : null}
        {showLeadHint ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent-soft px-3 py-2 text-accent">
            <span>
              {(vendor ?? designer)?.name} usually takes {lead} day{lead === 1 ? "" : "s"}
            </span>
            <button type="button" className="min-h-9 font-medium underline" onClick={() => setEnd(addDays(start, lead! - 1))}>
              Set end date
            </button>
          </div>
        ) : null}
      </div>

      <Field label="Assigned to">
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="none">Unassigned</option>
          <option value="me">Me</option>
          {context.vendors.length ? (
            <optgroup label="Vendors">
              {context.vendors.map((v) => (
                <option key={v.id} value={`v:${v.id}`}>
                  {v.name} · {VENDOR_TYPE_LABEL[v.type]}
                  {v.typical_lead_days ? ` · ${v.typical_lead_days}d` : ""}
                </option>
              ))}
            </optgroup>
          ) : null}
          {context.designers.length ? (
            <optgroup label="Designers">
              {context.designers.map((d) => (
                <option key={d.id} value={`d:${d.id}`}>
                  {d.name}
                  {d.typical_lead_days ? ` · ${d.typical_lead_days}d` : ""}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Status</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-accent-soft/70 p-1">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusValue(s)}
              aria-pressed={status === s}
              className={`min-h-10 rounded-full px-2 text-sm ${status === s ? "bg-surface font-semibold shadow-soft" : "text-stone-500"}`}
            >
              <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: STATUS_COLOR[s].bg }} />
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>

      {linkedExpenses.length > 0 && project ? (
        <p className="rounded-2xl bg-stone-100 px-3 py-2 text-sm">
          {formatMoney(totalOf(linkedExpenses))} spent on this task ({linkedExpenses.length} expense{linkedExpenses.length === 1 ? "" : "s"}).{" "}
          <Link href={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
            See expenses
          </Link>
        </p>
      ) : null}

      <FormError message={error} />

      {task ? (
        <button type="button" onClick={remove} className="min-h-11 text-sm font-medium text-risk hover:underline">
          Delete {task.kind === "milestone" ? "milestone" : "task"}
        </button>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {task && task.status !== "done" ? (
          <Button onClick={markDone} disabled={saving || !datesValid} className="flex-1">
            ✓ Mark done
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={saving || !dirty || !datesValid || !title.trim()} className="flex-1">
          {saving ? "Saving…" : task ? "Save" : isMilestone ? "Add milestone" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
