import { diffDays, toDayNumber, addDays } from "@/lib/dates";

export type Assignee = { typical_lead_days: number | null } | null | undefined;

export type DatedTask = {
  id: string;
  title: string;
  kind: "task" | "milestone";
  start_date: string;
  end_date: string;
  status: "not_started" | "in_progress" | "done";
};

/**
 * The assigned vendor's or designer's typical lead time, if any (the longer of
 * the two). Used to suggest an end date, never applied automatically.
 */
export function suggestedLeadDays(vendor?: Assignee, designer?: Assignee): number | null {
  const assigned = [vendor?.typical_lead_days, designer?.typical_lead_days].filter((d): d is number => typeof d === "number" && d > 0);
  return assigned.length > 0 ? Math.max(...assigned) : null;
}

/** By start date, then end date, then title. */
export function compareTasks(a: Pick<DatedTask, "start_date" | "end_date" | "title">, b: Pick<DatedTask, "start_date" | "end_date" | "title">) {
  return diffDays(a.start_date, b.start_date) || diffDays(a.end_date, b.end_date) || a.title.localeCompare(b.title);
}

export type RiskReason = { kind: "overdue"; taskIds: string[] } | { kind: "after_delivery"; taskIds: string[] };

export type ProjectRisk = { atRisk: boolean; reasons: RiskReason[] };

/**
 * A project is at risk when a task is past its end date and not done, or when
 * a task or milestone ends after the delivery date. Completed projects are
 * never at risk.
 */
export function assessProjectRisk(
  project: { delivery_date: string; status: "active" | "on_hold" | "completed" },
  tasks: DatedTask[],
  today: string,
): ProjectRisk {
  if (project.status === "completed") return { atRisk: false, reasons: [] };
  const reasons: RiskReason[] = [];

  const overdue = tasks.filter((t) => t.status !== "done" && diffDays(t.end_date, today) < 0);
  if (overdue.length > 0) reasons.push({ kind: "overdue", taskIds: overdue.map((t) => t.id) });

  const late = tasks.filter((t) => t.status !== "done" && diffDays(t.end_date, project.delivery_date) > 0);
  if (late.length > 0) reasons.push({ kind: "after_delivery", taskIds: late.map((t) => t.id) });

  return { atRisk: reasons.length > 0, reasons };
}

export function describeRisk(reason: RiskReason): string {
  const n = reason.taskIds.length;
  switch (reason.kind) {
    case "overdue":
      return n === 1 ? "1 task is past its end date" : `${n} tasks are past their end date`;
    case "after_delivery":
      return n === 1 ? "1 task ends after the delivery date" : `${n} tasks end after the delivery date`;
  }
}

/** Number of unfinished tasks (not milestones) running on each day, keyed by ISO date. */
export function activeTasksPerDay(tasks: { start_date: string; end_date: string; status: string; kind?: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done" || t.kind === "milestone") continue;
    for (let d = toDayNumber(t.start_date); d <= toDayNumber(t.end_date); d++) {
      const key = addDays("1970-01-01", d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export type AssigneeKey = "me" | "none" | `v:${string}` | `d:${string}`;

/** One key per assignee: "me", "none", "v:<vendor id>" or "d:<designer id>". */
export function assigneeKey(t: { assigned_to_self: boolean; vendor_id: string | null; designer_id: string | null }): AssigneeKey {
  if (t.assigned_to_self) return "me";
  if (t.vendor_id) return `v:${t.vendor_id}`;
  if (t.designer_id) return `d:${t.designer_id}`;
  return "none";
}

/** Columns to store for an assignee key. */
export function assigneeColumns(key: string) {
  return {
    assigned_to_self: key === "me",
    vendor_id: key.startsWith("v:") ? key.slice(2) : null,
    designer_id: key.startsWith("d:") ? key.slice(2) : null,
  };
}
