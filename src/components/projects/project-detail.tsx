"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { applyDateShifts, deleteRow, insertRow, updateRow } from "@/lib/mutations";
import { addDays, diffDays, durationDays, formatLong, formatRange, todayISO } from "@/lib/dates";
import { assessProjectRisk, describeRisk, scheduleBackward } from "@/lib/scheduling";
import { nextTaskStatus, PROJECT_STATUSES, PROJECT_STATUS_LABEL, STATUS_COLOR, TASK_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, text } from "@/lib/form";
import { ExpensesSection } from "@/components/expenses/expenses-section";
import { formatMoney, totalOf } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseCategory, Project, Stage, Task, TaskContext } from "@/lib/types";
import { ProjectBadges } from "./project-badges";

export function ProjectDetail({ project, context, categories }: { project: Project; context: TaskContext; categories: ExpenseCategory[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { setStatus } = useTaskActions(context.tasks);
  const client = context.clients[0];
  const tasks = [...context.tasks].sort((a, b) => a.sort_order - b.sort_order);
  const today = todayISO();
  const risk = assessProjectRisk(project, tasks, today);
  const done = tasks.filter((t) => t.status === "done").length;
  const expenses = context.expenses ?? [];

  function togglePicked(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setPicked(new Set());
  }

  async function deletePicked() {
    const ids = [...picked];
    if (ids.length === 0) return;
    const linked = expenses.filter((e) => e.task_id && picked.has(e.task_id)).length;
    const ok = await confirm({
      title: `Delete ${ids.length} stage${ids.length === 1 ? "" : "s"}?`,
      message: (
        <>
          {tasks
            .filter((t) => picked.has(t.id))
            .map((t) => t.stage_name)
            .join(", ")}{" "}
          will be removed from this project, with their dates, assignments and notes.
          {linked > 0 ? ` ${linked} linked expense${linked === 1 ? " stays" : "s stay"} on the project, no longer linked to a stage.` : ""}
        </>
      ),
      choices: [{ value: "delete", label: `Delete ${ids.length} stage${ids.length === 1 ? "" : "s"}`, variant: "danger" }],
    });
    if (!ok) return;
    try {
      const { error } = await createClient().from("tasks").delete().in("id", ids);
      if (error) throw error;
      toast(`${ids.length} stage${ids.length === 1 ? "" : "s"} deleted`);
      stopSelecting();
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${project.name}?`,
      message: `This permanently deletes the project with all its stages${expenses.length ? ` and ${expenses.length} expense${expenses.length === 1 ? "" : "s"}` : ""}.`,
      choices: [{ value: "delete", label: "Delete project", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("projects", project.id);
      toast("Project deleted");
      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <Link href={`/clients/${client.id}`} className="mb-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ‹ {client.name}
      </Link>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Delivery {formatLong(project.delivery_date)} · {done}/{tasks.length} stages done
            <ProjectBadges project={project} risk={risk} />
          </span>
        }
        actions={
          <>
            <Link href={`/?client=${client.id}`} className="inline-flex min-h-11 items-center rounded-full bg-surface px-5 text-sm font-semibold shadow-soft hover:bg-stone-50">
              View timeline
            </Link>
            <Button onClick={() => setEditing(true)}>Edit project</Button>
          </>
        }
      />

      {risk.atRisk ? (
        <div className="mb-4 rounded-3xl bg-risk-soft px-4 py-3 text-sm text-risk">
          <p className="font-semibold">⚠ This project is at risk</p>
          <ul className="mt-1 list-disc pl-5">
            {risk.reasons.map((r) => (
              <li key={r.kind}>{describeRisk(r)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card>
        <ol>
          {tasks.map((task, index) => {
            const vendor = context.vendors.find((v) => v.id === task.vendor_id);
            const designer = context.designers.find((d) => d.id === task.designer_id);
            const overdue = task.status !== "done" && diffDays(task.end_date, today) < 0;
            const stageSpend = totalOf(expenses.filter((e) => e.task_id === task.id));
            const isPicked = picked.has(task.id);
            return (
              <li key={task.id} className={`flex items-stretch border-b border-line last:border-0 ${isPicked ? "bg-risk-soft" : ""}`}>
                {selecting ? (
                  <label className="flex w-14 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => togglePicked(task.id)}
                      aria-label={`Select ${task.stage_name}`}
                      className="size-5 accent-(--color-risk)"
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(task, nextTaskStatus(task.status))}
                    className="flex w-14 shrink-0 items-center justify-center hover:bg-stone-50"
                    aria-label={`${TASK_STATUS_LABEL[task.status]}. Change status of ${task.stage_name}`}
                    title={`${TASK_STATUS_LABEL[task.status]} — tap to change`}
                  >
                    <StatusIcon status={task.status} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (selecting ? togglePicked(task.id) : setSelectedTaskId(task.id))}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left hover:bg-stone-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${task.status === "done" ? "text-muted line-through" : ""}`}>
                      {index + 1}. {task.stage_name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[vendor?.name, designer?.name].filter(Boolean).join(", ") || "Unassigned"}
                      {stageSpend > 0 ? ` · ${formatMoney(stageSpend)} spent` : ""}
                      {task.notes ? ` · ${task.notes}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className={`block ${overdue ? "font-semibold text-risk" : "text-stone-600"}`}>{formatRange(task.start_date, task.end_date)}</span>
                    <span className="block text-muted">{durationDays(task.start_date, task.end_date)} days</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {tasks.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">This project has no stages yet.</p> : null}
      </Card>
      {selecting ? (
        <div className="sticky bottom-20 z-30 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-surface shadow-soft p-2 shadow-lg md:bottom-4">
          <span className="px-2 text-sm">{picked.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={stopSelecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deletePicked} disabled={picked.size === 0}>
              Delete {picked.size > 0 ? picked.size : ""} stage{picked.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Tap the circle to change a stage’s status. Tap a stage to edit dates, assign a vendor or designer, or add notes.</p>
          <div className="flex gap-2">
            {tasks.length > 0 ? <Button onClick={() => setSelecting(true)}>Delete stages…</Button> : null}
            <Button onClick={() => setAddingStage(true)}>+ Add stage</Button>
          </div>
        </div>
      )}

      <ExpensesSection
        projectId={project.id}
        expenses={expenses}
        categories={categories}
        tasks={tasks}
        vendors={context.vendors}
        designers={context.designers}
      />

      {project.notes ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">Notes</h2>
          <Card className="px-4 py-3 text-sm whitespace-pre-wrap">{project.notes}</Card>
        </section>
      ) : null}

      <Button variant="danger" className="mt-6" onClick={remove}>
        Delete project
      </Button>

      <TaskDetailPanel task={tasks.find((t) => t.id === selectedTaskId) ?? null} context={context} onClose={() => setSelectedTaskId(null)} />
      <Sheet open={addingStage} onClose={() => setAddingStage(false)} title="Add stage">
        {addingStage ? <AddStageForm projectId={project.id} tasks={tasks} stages={context.stages} onClose={() => setAddingStage(false)} /> : null}
      </Sheet>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit project">
        {editing ? <EditProjectForm project={project} tasks={tasks} onClose={() => setEditing(false)} /> : null}
      </Sheet>
    </>
  );
}

function StatusIcon({ status }: { status: Task["status"] }) {
  if (status === "done") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full font-bold" style={{ background: STATUS_COLOR.done.bg, color: STATUS_COLOR.done.text }}>
        ✓
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full border-2" style={{ borderColor: "#7fa3d9" }}>
        <span className="size-3 rounded-full" style={{ background: "#7fa3d9" }} />
      </span>
    );
  }
  return <span className="size-7 rounded-full border-2 border-stone-300" />;
}

function EditProjectForm({ project, tasks, onClose }: { project: Project; tasks: Task[]; onClose: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = {
      name: text(form, "name") ?? project.name,
      delivery_date: text(form, "delivery_date") ?? project.delivery_date,
      status: (text(form, "status") ?? project.status) as Project["status"],
      notes: text(form, "notes"),
    };

    // Moving the delivery date can reschedule unfinished stages backward from
    // the new date, keeping each stage's current length.
    let reschedule: { id: string; start_date: string; end_date: string }[] = [];
    if (values.delivery_date !== project.delivery_date && tasks.some((t) => t.status !== "done")) {
      const plan = scheduleBackward(
        tasks.map((t) => ({ name: t.id, sort_order: t.sort_order, default_lead_days: durationDays(t.start_date, t.end_date) })),
        values.delivery_date,
      );
      const choice = await confirm({
        title: "Reschedule stages?",
        message: `The delivery date moves from ${formatLong(project.delivery_date)} to ${formatLong(values.delivery_date)}. Reschedule the unfinished stages backward from the new date, keeping their lengths?`,
        choices: [
          { value: "keep", label: "Keep stage dates" },
          { value: "reschedule", label: "Reschedule", variant: "primary" },
        ],
      });
      if (choice === null) return;
      if (choice === "reschedule") {
        reschedule = plan
          .filter((p) => tasks.find((t) => t.id === p.stage_name)?.status !== "done")
          .map((p) => ({ id: p.stage_name, start_date: p.start_date, end_date: p.end_date }));
      }
    }

    setPending(true);
    setError(null);
    try {
      await updateRow("projects", project.id, values);
      if (reschedule.length) await applyDateShifts(reschedule);
      toast(reschedule.length ? `Project saved and ${reschedule.length} stages rescheduled` : "Project saved");
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Project name">
        <Input name="name" defaultValue={project.name} required />
      </Field>
      <Field label="Delivery date">
        <Input name="delivery_date" type="date" defaultValue={project.delivery_date} required />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={project.status}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={project.notes ?? ""} rows={4} />
      </Field>
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save project"}
      </Button>
    </form>
  );
}

function AddStageForm({ projectId, tasks, stages, onClose }: { projectId: string; tasks: Task[]; stages: Stage[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const available = stages.filter((s) => !tasks.some((t) => t.stage_name === s.name));
  const [stageId, setStageId] = useState(available[0]?.id ?? "");
  const stage = available.find((s) => s.id === stageId);
  const [start, setStart] = useState(() => suggestedStart(available[0], tasks));
  const [days, setDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const n = Number.parseInt(days, 10);
  const validDays = Number.isInteger(n) && n >= 1 && n <= 365;
  const end = start && validDays ? addDays(start, n - 1) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stage || !end) return;
    setPending(true);
    setError(null);
    try {
      await insertRow("tasks", { project_id: projectId, stage_name: stage.name, sort_order: stage.sort_order, start_date: start, end_date: end });
      toast(`${stage.name} added`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (available.length === 0) {
    return <p className="text-sm text-muted">Every stage from Settings is already in this project. Add new stage types in Settings.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Stage">
        <Select
          value={stageId}
          onChange={(e) => {
            setStageId(e.target.value);
            setStart(suggestedStart(available.find((s) => s.id === e.target.value), tasks));
          }}
        >
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="Days">
          <Input type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} required />
        </Field>
      </div>
      {end ? <p className="text-sm text-muted">Runs {formatRange(start, end)}</p> : null}
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || !end}>
        {pending ? "Adding…" : "Add stage"}
      </Button>
    </form>
  );
}

/** Day after the stage that comes before this one in the Settings order, or today. */
function suggestedStart(stage: Stage | undefined, tasks: Task[]) {
  const before = tasks.filter((t) => stage && t.sort_order < stage.sort_order);
  if (before.length === 0) return todayISO();
  const lastEnd = before.reduce((latest, t) => (diffDays(t.end_date, latest) > 0 ? t.end_date : latest), before[0].end_date);
  return addDays(lastEnd, 1);
}
