import { addDays, diffDays, durationDays, toDayNumber } from "@/lib/dates";

export type StageDefinition = {
  name: string;
  sort_order: number;
  default_lead_days: number;
};

export type Assignee = { typical_lead_days: number | null } | null | undefined;

export type PlannedTask = {
  stage_name: string;
  sort_order: number;
  start_date: string;
  end_date: string;
  lead_days: number;
};

export type ScheduledTask = {
  id: string;
  sort_order: number;
  start_date: string;
  end_date: string;
  status: "not_started" | "in_progress" | "done";
};

/**
 * Lead time for a task: the assigned vendor's or designer's typical lead time
 * when set (the longer of the two if both are assigned), otherwise the stage
 * default.
 */
export function leadDaysFor(stageDefault: number, vendor?: Assignee, designer?: Assignee): number {
  const assigned = [vendor?.typical_lead_days, designer?.typical_lead_days].filter(
    (d): d is number => typeof d === "number" && d > 0,
  );
  return assigned.length > 0 ? Math.max(...assigned) : stageDefault;
}

/**
 * Schedules stages backward from the delivery date. The last stage ends on the
 * delivery date and every earlier stage ends the day before the next one
 * starts. Durations are inclusive calendar days.
 */
export function scheduleBackward(
  stages: StageDefinition[],
  deliveryDate: string,
  leadDays: (stage: StageDefinition) => number = (s) => s.default_lead_days,
): PlannedTask[] {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const planned: PlannedTask[] = [];
  let end = deliveryDate;

  for (let i = ordered.length - 1; i >= 0; i--) {
    const stage = ordered[i];
    const lead = Math.max(1, Math.round(leadDays(stage)));
    const start = addDays(end, -(lead - 1));
    planned.unshift({
      stage_name: stage.name,
      sort_order: stage.sort_order,
      start_date: start,
      end_date: end,
      lead_days: lead,
    });
    end = addDays(start, -1);
  }

  return planned;
}

/** Tasks whose planned start date is already in the past. */
export function tasksStartingInPast<T extends { start_date: string }>(tasks: T[], today: string): T[] {
  return tasks.filter((t) => diffDays(t.start_date, today) < 0);
}

export type DateShift = { id: string; start_date: string; end_date: string };

/**
 * When a task's end date moves by N days, every later task in the same project
 * that isn't done moves by the same N days, keeping its duration.
 */
export function shiftLaterTasks(
  tasks: ScheduledTask[],
  changedTaskId: string,
  previousEnd: string,
  newEnd: string,
): DateShift[] {
  const changed = tasks.find((t) => t.id === changedTaskId);
  const delta = diffDays(newEnd, previousEnd);
  if (!changed || delta === 0) return [];

  return tasks
    .filter((t) => t.id !== changed.id && t.sort_order > changed.sort_order && t.status !== "done")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({
      id: t.id,
      start_date: addDays(t.start_date, delta),
      end_date: addDays(t.end_date, delta),
    }));
}

export type RiskReason =
  | { kind: "overdue"; taskIds: string[] }
  | { kind: "ends_after_delivery"; daysLate: number }
  | { kind: "cannot_fit"; daysShort: number };

export type ProjectRisk = { atRisk: boolean; reasons: RiskReason[] };

/**
 * A project is at risk when a task is past its end date and not done, when its
 * schedule ends after the delivery date, or when the work left can no longer
 * fit between today and the delivery date. Completed projects are never at risk.
 */
export function assessProjectRisk(
  project: { delivery_date: string; status: "active" | "on_hold" | "completed" },
  tasks: ScheduledTask[],
  today: string,
): ProjectRisk {
  if (project.status === "completed") return { atRisk: false, reasons: [] };

  const reasons: RiskReason[] = [];

  const overdue = tasks.filter((t) => t.status !== "done" && diffDays(t.end_date, today) < 0);
  if (overdue.length > 0) reasons.push({ kind: "overdue", taskIds: overdue.map((t) => t.id) });

  const lastEnd = tasks.reduce<string | null>(
    (latest, t) => (latest === null || toDayNumber(t.end_date) > toDayNumber(latest) ? t.end_date : latest),
    null,
  );
  if (lastEnd && diffDays(lastEnd, project.delivery_date) > 0) {
    reasons.push({ kind: "ends_after_delivery", daysLate: diffDays(lastEnd, project.delivery_date) });
  }

  const remainingWork = tasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + remainingDays(t, today), 0);
  const daysAvailable = Math.max(0, durationDays(today, project.delivery_date));
  if (remainingWork > daysAvailable) {
    reasons.push({ kind: "cannot_fit", daysShort: remainingWork - daysAvailable });
  }

  return { atRisk: reasons.length > 0, reasons };
}

/** Days of work left on a task, counting from today for tasks already under way. */
function remainingDays(task: ScheduledTask, today: string) {
  if (task.status === "in_progress" && diffDays(today, task.start_date) > 0) {
    return Math.max(1, durationDays(today, task.end_date));
  }
  return durationDays(task.start_date, task.end_date);
}

export function describeRisk(reason: RiskReason): string {
  switch (reason.kind) {
    case "overdue":
      return reason.taskIds.length === 1
        ? "1 task is past its end date"
        : `${reason.taskIds.length} tasks are past their end date`;
    case "ends_after_delivery":
      return `Schedule ends ${reason.daysLate} day${reason.daysLate === 1 ? "" : "s"} after delivery`;
    case "cannot_fit":
      return `Remaining work needs ${reason.daysShort} more day${reason.daysShort === 1 ? "" : "s"} than are left`;
  }
}

/** Number of unfinished tasks running on each day, keyed by ISO date. */
export function activeTasksPerDay(
  tasks: { start_date: string; end_date: string; status: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done") continue;
    for (let d = toDayNumber(t.start_date); d <= toDayNumber(t.end_date); d++) {
      const key = addDays("1970-01-01", d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
