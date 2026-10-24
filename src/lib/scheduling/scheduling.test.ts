import { describe, expect, it } from "vitest";
import {
  activeTasksPerDay,
  assessProjectRisk,
  leadDaysFor,
  scheduleBackward,
  shiftLaterTasks,
  tasksStartingInPast,
  type ScheduledTask,
} from "./index";
import { addDays, diffDays, durationDays, todayISO } from "@/lib/dates";

const DEFAULT_STAGES = [
  { name: "Research", sort_order: 1, default_lead_days: 5 },
  { name: "Client requirement gathering", sort_order: 2, default_lead_days: 3 },
  { name: "Designs/patterns from designer", sort_order: 3, default_lead_days: 10 },
  { name: "Buying fabric from vendor", sort_order: 4, default_lead_days: 7 },
  { name: "Sampling on fabric", sort_order: 5, default_lead_days: 7 },
  { name: "Fabric printing / manufacturing", sort_order: 6, default_lead_days: 14 },
  { name: "Reviewing printed fabric", sort_order: 7, default_lead_days: 3 },
  { name: "Shipping to client", sort_order: 8, default_lead_days: 5 },
];

describe("dates", () => {
  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("counts inclusive durations", () => {
    expect(durationDays("2026-05-01", "2026-05-01")).toBe(1);
    expect(durationDays("2026-05-01", "2026-05-05")).toBe(5);
  });

  it("uses the local calendar date for today", () => {
    expect(todayISO(new Date(2026, 9, 24, 23, 59))).toBe("2026-10-24");
  });
});

describe("leadDaysFor", () => {
  it("uses the stage default when nobody is assigned", () => {
    expect(leadDaysFor(7)).toBe(7);
    expect(leadDaysFor(7, { typical_lead_days: null })).toBe(7);
  });

  it("prefers the assignee's typical lead time", () => {
    expect(leadDaysFor(7, { typical_lead_days: 12 })).toBe(12);
    expect(leadDaysFor(10, null, { typical_lead_days: 4 })).toBe(4);
  });

  it("takes the longer lead time when a vendor and designer are both assigned", () => {
    expect(leadDaysFor(7, { typical_lead_days: 5 }, { typical_lead_days: 9 })).toBe(9);
  });
});

describe("scheduleBackward", () => {
  const plan = scheduleBackward(DEFAULT_STAGES, "2027-03-31");

  it("ends the last stage on the delivery date", () => {
    expect(plan.at(-1)).toMatchObject({ stage_name: "Shipping to client", start_date: "2027-03-27", end_date: "2027-03-31" });
  });

  it("chains stages back to back with no gaps or overlaps", () => {
    for (let i = 1; i < plan.length; i++) {
      expect(diffDays(plan[i].start_date, plan[i - 1].end_date)).toBe(1);
    }
  });

  it("gives every stage its lead time as an inclusive duration", () => {
    plan.forEach((task, i) => {
      expect(durationDays(task.start_date, task.end_date)).toBe(DEFAULT_STAGES[i].default_lead_days);
    });
  });

  it("starts 54 days before delivery in total", () => {
    expect(durationDays(plan[0].start_date, "2027-03-31")).toBe(54);
  });

  it("uses custom lead times when provided", () => {
    const custom = scheduleBackward(DEFAULT_STAGES.slice(-2), "2027-03-31", (s) => (s.sort_order === 8 ? 2 : 1));
    expect(custom).toEqual([
      expect.objectContaining({ start_date: "2027-03-29", end_date: "2027-03-29", lead_days: 1 }),
      expect.objectContaining({ start_date: "2027-03-30", end_date: "2027-03-31", lead_days: 2 }),
    ]);
  });

  it("orders stages by sort order regardless of input order", () => {
    const shuffled = [...DEFAULT_STAGES].reverse();
    expect(scheduleBackward(shuffled, "2027-03-31").map((t) => t.sort_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("flags stages that would start in the past", () => {
    const tight = scheduleBackward(DEFAULT_STAGES, "2026-11-10");
    expect(tasksStartingInPast(tight, "2026-10-24").length).toBeGreaterThan(0);
    expect(tasksStartingInPast(plan, "2026-10-24")).toEqual([]);
  });
});

const task = (id: string, sort_order: number, start: string, end: string, status: ScheduledTask["status"] = "not_started"): ScheduledTask => ({
  id,
  sort_order,
  start_date: start,
  end_date: end,
  status,
});

describe("shiftLaterTasks", () => {
  const tasks = [
    task("a", 1, "2026-11-01", "2026-11-05", "done"),
    task("b", 2, "2026-11-06", "2026-11-08"),
    task("c", 3, "2026-11-09", "2026-11-12"),
    task("d", 4, "2026-11-13", "2026-11-14", "done"),
  ];

  it("moves later unfinished tasks by the same number of days", () => {
    expect(shiftLaterTasks(tasks, "b", "2026-11-08", "2026-11-11")).toEqual([
      { id: "c", start_date: "2026-11-12", end_date: "2026-11-15" },
    ]);
  });

  it("can pull tasks earlier", () => {
    expect(shiftLaterTasks(tasks, "a", "2026-11-05", "2026-11-03")).toEqual([
      { id: "b", start_date: "2026-11-04", end_date: "2026-11-06" },
      { id: "c", start_date: "2026-11-07", end_date: "2026-11-10" },
    ]);
  });

  it("does nothing when the end date is unchanged", () => {
    expect(shiftLaterTasks(tasks, "b", "2026-11-08", "2026-11-08")).toEqual([]);
  });
});

describe("assessProjectRisk", () => {
  const project = { delivery_date: "2026-12-01", status: "active" as const };

  it("is fine when everything fits and nothing is overdue", () => {
    const tasks = [task("a", 1, "2026-11-01", "2026-11-10"), task("b", 2, "2026-11-11", "2026-12-01")];
    expect(assessProjectRisk(project, tasks, "2026-10-24")).toEqual({ atRisk: false, reasons: [] });
  });

  it("flags tasks past their end date that aren't done", () => {
    const tasks = [task("a", 1, "2026-10-01", "2026-10-20"), task("b", 2, "2026-10-21", "2026-10-22", "done")];
    const risk = assessProjectRisk(project, tasks, "2026-10-24");
    expect(risk.atRisk).toBe(true);
    expect(risk.reasons).toContainEqual({ kind: "overdue", taskIds: ["a"] });
  });

  it("flags a schedule that ends after the delivery date", () => {
    const tasks = [task("a", 1, "2026-11-20", "2026-12-04")];
    expect(assessProjectRisk(project, tasks, "2026-10-24").reasons).toContainEqual({ kind: "ends_after_delivery", daysLate: 3 });
  });

  it("flags remaining work that no longer fits before delivery", () => {
    const tasks = [task("a", 1, "2026-10-01", "2026-11-20"), task("b", 2, "2026-11-21", "2026-12-01")];
    const risk = assessProjectRisk(project, tasks, "2026-11-25");
    expect(risk.reasons.some((r) => r.kind === "cannot_fit")).toBe(true);
  });

  it("counts only the remaining part of tasks already in progress", () => {
    const tasks = [task("a", 1, "2026-10-01", "2026-11-20", "in_progress"), task("b", 2, "2026-11-21", "2026-12-01")];
    expect(assessProjectRisk(project, tasks, "2026-11-01").atRisk).toBe(false);
  });

  it("never flags completed projects", () => {
    const tasks = [task("a", 1, "2026-10-01", "2026-10-02")];
    expect(assessProjectRisk({ ...project, status: "completed" }, tasks, "2026-10-24").atRisk).toBe(false);
  });
});

describe("activeTasksPerDay", () => {
  it("counts overlapping unfinished tasks per day", () => {
    const counts = activeTasksPerDay([
      { start_date: "2026-11-01", end_date: "2026-11-03", status: "in_progress" },
      { start_date: "2026-11-03", end_date: "2026-11-04", status: "not_started" },
      { start_date: "2026-11-01", end_date: "2026-11-10", status: "done" },
    ]);
    expect(counts.get("2026-11-01")).toBe(1);
    expect(counts.get("2026-11-03")).toBe(2);
    expect(counts.get("2026-11-05")).toBeUndefined();
  });
});
