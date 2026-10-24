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
import { applyDateShifts, deleteRow, updateRow } from "@/lib/mutations";
import { diffDays, durationDays, formatLong, formatRange, todayISO } from "@/lib/dates";
import { assessProjectRisk, describeRisk, scheduleBackward } from "@/lib/scheduling";
import { nextTaskStatus, PROJECT_STATUSES, PROJECT_STATUS_LABEL, STATUS_COLOR, TASK_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, text } from "@/lib/form";
import type { Project, Task, TaskContext } from "@/lib/types";
import { ProjectBadges } from "./project-badges";

export function ProjectDetail({ project, context }: { project: Project; context: TaskContext }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { setStatus } = useTaskActions(context.tasks);
  const client = context.clients[0];
  const tasks = [...context.tasks].sort((a, b) => a.sort_order - b.sort_order);
  const today = todayISO();
  const risk = assessProjectRisk(project, tasks, today);
  const done = tasks.filter((t) => t.status === "done").length;

  async function remove() {
    const ok = await confirm({
      title: `Delete ${project.name}?`,
      message: "This permanently deletes the project and all its tasks.",
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
            <Link href={`/?client=${client.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-stone-50">
              View timeline
            </Link>
            <Button onClick={() => setEditing(true)}>Edit project</Button>
          </>
        }
      />

      {risk.atRisk ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-risk-soft px-4 py-3 text-sm text-risk">
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
          {tasks.map((task) => {
            const vendor = context.vendors.find((v) => v.id === task.vendor_id);
            const designer = context.designers.find((d) => d.id === task.designer_id);
            const overdue = task.status !== "done" && diffDays(task.end_date, today) < 0;
            return (
              <li key={task.id} className="flex items-stretch border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => setStatus(task, nextTaskStatus(task.status))}
                  className="flex w-14 shrink-0 items-center justify-center hover:bg-stone-50"
                  aria-label={`${TASK_STATUS_LABEL[task.status]}. Change status of ${task.stage_name}`}
                  title={`${TASK_STATUS_LABEL[task.status]} — tap to change`}
                >
                  <StatusIcon status={task.status} />
                </button>
                <button type="button" onClick={() => setSelectedTaskId(task.id)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left hover:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${task.status === "done" ? "text-muted line-through" : ""}`}>
                      {task.sort_order}. {task.stage_name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[vendor?.name, designer?.name].filter(Boolean).join(", ") || "Unassigned"}
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
      </Card>
      <p className="mt-2 text-xs text-muted">Tap the circle to change a stage’s status. Tap a stage to edit dates, assign a vendor or designer, or add notes.</p>

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
      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit project">
        {editing ? <EditProjectForm project={project} tasks={tasks} onClose={() => setEditing(false)} /> : null}
      </Sheet>
    </>
  );
}

function StatusIcon({ status }: { status: Task["status"] }) {
  if (status === "done") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full text-white" style={{ background: STATUS_COLOR.done.bg }}>
        ✓
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full border-2" style={{ borderColor: STATUS_COLOR.in_progress.bg }}>
        <span className="size-3 rounded-full" style={{ background: STATUS_COLOR.in_progress.bg }} />
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
