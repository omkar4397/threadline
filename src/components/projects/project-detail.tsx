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
import { TaskDetailPanel, type NewTaskDraft } from "@/components/tasks/task-detail-panel";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { deleteRow, updateRow } from "@/lib/mutations";
import { diffDays, durationDays, formatLong, formatRange, todayISO } from "@/lib/dates";
import { assessProjectRisk, compareTasks, describeRisk } from "@/lib/scheduling";
import { nextTaskStatus, PROJECT_STATUSES, PROJECT_STATUS_LABEL, STATUS_COLOR, TASK_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, text } from "@/lib/form";
import { ExpensesSection } from "@/components/expenses/expenses-section";
import { PricingSection, type LatestRatesProp } from "@/components/pricing/pricing-section";
import { formatMoney, totalOf } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseCategory, PricingItemType, PricingLine, PricingProduct, Project, ProjectFxRate, Task, TaskContext } from "@/lib/types";
import { ProjectBadges } from "./project-badges";

export type PricingProps = {
  lines: PricingLine[];
  itemTypes: PricingItemType[];
  products: PricingProduct[];
  lockedRates: ProjectFxRate[];
  latest: LatestRatesProp;
  fabricNames: string[];
};

export function ProjectDetail({
  project,
  context,
  categories,
  pricing,
}: {
  project: Project;
  context: TaskContext;
  categories: ExpenseCategory[];
  pricing: PricingProps;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NewTaskDraft | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { setStatus } = useTaskActions();
  const client = context.clients[0];
  const tasks = [...context.tasks].sort(compareTasks);
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
      title: `Delete ${ids.length} item${ids.length === 1 ? "" : "s"}?`,
      message: (
        <>
          {tasks
            .filter((t) => picked.has(t.id))
            .map((t) => t.title)
            .join(", ")}{" "}
          will be removed from this project, with their dates, assignments and notes.
          {linked > 0 ? ` ${linked} linked expense${linked === 1 ? " stays" : "s stay"} on the project, no longer linked to a task.` : ""}
        </>
      ),
      choices: [{ value: "delete", label: `Delete ${ids.length}`, variant: "danger" }],
    });
    if (!ok) return;
    try {
      const { error } = await createClient().from("tasks").delete().in("id", ids);
      if (error) throw error;
      toast(`${ids.length} deleted`);
      stopSelecting();
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${project.name}?`,
      message: `This permanently deletes the project with all its tasks${expenses.length ? ` and ${expenses.length} expense${expenses.length === 1 ? "" : "s"}` : ""}.`,
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
            Delivery {formatLong(project.delivery_date)} · {done}/{tasks.length} done
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

      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold">Tasks &amp; milestones</h2>
        {selecting ? null : (
          <div className="flex flex-wrap gap-2">
            {tasks.length > 0 ? <Button onClick={() => setSelecting(true)}>Select…</Button> : null}
            <Button onClick={() => setDraft({ kind: "milestone", projectId: project.id })}>+ Milestone</Button>
            <Button variant="primary" onClick={() => setDraft({ kind: "task", projectId: project.id })}>
              + Task
            </Button>
          </div>
        )}
      </div>
      <Card>
        <ol>
          {tasks.map((task) => {
            const vendor = context.vendors.find((v) => v.id === task.vendor_id);
            const designer = context.designers.find((d) => d.id === task.designer_id);
            const assignee = task.assigned_to_self ? "Me" : (vendor?.name ?? designer?.name ?? "Unassigned");
            const overdue = task.status !== "done" && diffDays(task.end_date, today) < 0;
            const milestone = task.kind === "milestone";
            const taskSpend = totalOf(expenses.filter((e) => e.task_id === task.id));
            const isPicked = picked.has(task.id);
            return (
              <li key={task.id} className={`flex items-stretch border-b border-line last:border-0 ${isPicked ? "bg-risk-soft" : ""}`}>
                {selecting ? (
                  <label className="flex w-14 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => togglePicked(task.id)}
                      aria-label={`Select ${task.title}`}
                      className="size-5 accent-(--color-risk)"
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(task, nextTaskStatus(task.status))}
                    className="flex w-14 shrink-0 items-center justify-center hover:bg-stone-50"
                    aria-label={`${TASK_STATUS_LABEL[task.status]}. Change status of ${task.title}`}
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
                    <span className={`flex items-center gap-1.5 truncate text-sm font-medium ${task.status === "done" ? "text-muted line-through" : ""}`}>
                      {milestone ? <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-label="Milestone" /> : null}
                      <span className="truncate">{task.title}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {assignee}
                      {taskSpend > 0 ? ` · ${formatMoney(taskSpend)} spent` : ""}
                      {task.notes ? ` · ${task.notes}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className={`block ${overdue ? "font-semibold text-risk" : "text-stone-600"}`}>{formatRange(task.start_date, task.end_date)}</span>
                    <span className="block text-muted">{milestone ? "Milestone" : `${durationDays(task.start_date, task.end_date)} day${durationDays(task.start_date, task.end_date) === 1 ? "" : "s"}`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No tasks yet. Add one for each piece of work, like research, sampling or printing, and milestones for key dates.</p>
        ) : null}
      </Card>
      {selecting ? (
        <div className="sticky bottom-20 z-30 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-surface shadow-soft p-2 shadow-lg md:bottom-4">
          <span className="px-2 text-sm">{picked.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={stopSelecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deletePicked} disabled={picked.size === 0}>
              Delete {picked.size > 0 ? picked.size : ""}
            </Button>
          </div>
        </div>
      ) : tasks.length > 0 ? (
        <p className="mt-2 text-xs text-muted">Tap the circle to change status. Tap a row to edit dates, who it’s assigned to, or notes.</p>
      ) : null}

      <PricingSection project={project} {...pricing} vendors={context.vendors} designers={context.designers} />

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

      <TaskDetailPanel
        task={tasks.find((t) => t.id === selectedTaskId) ?? null}
        draft={selectedTaskId ? null : draft}
        context={context}
        onClose={() => {
          setSelectedTaskId(null);
          setDraft(null);
        }}
      />
      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit project">
        {editing ? <EditProjectForm project={project} onClose={() => setEditing(false)} /> : null}
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

function EditProjectForm({ project, onClose }: { project: Project; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await updateRow("projects", project.id, {
        name: text(form, "name") ?? project.name,
        delivery_date: text(form, "delivery_date") ?? project.delivery_date,
        status: (text(form, "status") ?? project.status) as Project["status"],
        notes: text(form, "notes"),
      });
      toast("Project saved");
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
