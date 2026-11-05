import { describe, expect, it } from "vitest";
import {
  activeTasksPerDay,
  assessProjectRisk,
  assigneeColumns,
  assigneeKey,
  compareTasks,
  suggestedLeadDays,
  type DatedTask,
} from "./index";
import { addDays, durationDays, todayISO } from "@/lib/dates";

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

describe("suggestedLeadDays", () => {
  it("is empty when nobody with a lead time is assigned", () => {
    expect(suggestedLeadDays()).toBeNull();
    expect(suggestedLeadDays({ typical_lead_days: null })).toBeNull();
  });

  it("uses the assignee's typical lead time, the longer of two", () => {
    expect(suggestedLeadDays({ typical_lead_days: 12 })).toBe(12);
    expect(suggestedLeadDays({ typical_lead_days: 5 }, { typical_lead_days: 9 })).toBe(9);
  });
});

const task = (id: string, start: string, end: string, status: DatedTask["status"] = "not_started", kind: DatedTask["kind"] = "task"): DatedTask => ({
  id,
  title: id,
  kind,
  start_date: start,
  end_date: end,
  status,
});

describe("compareTasks", () => {
  it("orders by start date, then end date, then title", () => {
    const list = [task("b", "2026-11-02", "2026-11-04"), task("c", "2026-11-01", "2026-11-09"), task("a", "2026-11-02", "2026-11-04"), task("d", "2026-11-01", "2026-11-03")];
    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("assessProjectRisk", () => {
  const project = { delivery_date: "2026-12-01", status: "active" as const };

  it("is fine when nothing is overdue or late", () => {
    expect(assessProjectRisk(project, [task("a", "2026-11-01", "2026-11-10"), task("b", "2026-11-05", "2026-12-01")], "2026-10-24")).toEqual({ atRisk: false, reasons: [] });
  });

  it("flags unfinished tasks past their end date", () => {
    const risk = assessProjectRisk(project, [task("a", "2026-10-01", "2026-10-20"), task("b", "2026-10-21", "2026-10-22", "done")], "2026-10-24");
    expect(risk.reasons).toEqual([{ kind: "overdue", taskIds: ["a"] }]);
  });

  it("flags unfinished tasks and milestones after delivery", () => {
    const risk = assessProjectRisk(project, [task("a", "2026-11-20", "2026-12-04"), task("m", "2026-12-03", "2026-12-03", "not_started", "milestone"), task("x", "2026-12-02", "2026-12-02", "done")], "2026-10-24");
    expect(risk.reasons).toEqual([{ kind: "after_delivery", taskIds: ["a", "m"] }]);
  });

  it("never flags completed projects", () => {
    expect(assessProjectRisk({ ...project, status: "completed" }, [task("a", "2026-10-01", "2026-10-02")], "2026-10-24").atRisk).toBe(false);
  });
});

describe("assignees", () => {
  it("maps rows to keys and back", () => {
    expect(assigneeKey({ assigned_to_self: true, vendor_id: null, designer_id: null })).toBe("me");
    expect(assigneeKey({ assigned_to_self: false, vendor_id: "v1", designer_id: null })).toBe("v:v1");
    expect(assigneeKey({ assigned_to_self: false, vendor_id: null, designer_id: "d1" })).toBe("d:d1");
    expect(assigneeKey({ assigned_to_self: false, vendor_id: null, designer_id: null })).toBe("none");
    expect(assigneeColumns("me")).toEqual({ assigned_to_self: true, vendor_id: null, designer_id: null });
    expect(assigneeColumns("d:d1")).toEqual({ assigned_to_self: false, vendor_id: null, designer_id: "d1" });
    expect(assigneeColumns("none")).toEqual({ assigned_to_self: false, vendor_id: null, designer_id: null });
  });
});

describe("activeTasksPerDay", () => {
  it("counts overlapping unfinished tasks per day", () => {
    const counts = activeTasksPerDay([
      { start_date: "2026-11-01", end_date: "2026-11-03", status: "in_progress" },
      { start_date: "2026-11-03", end_date: "2026-11-04", status: "not_started" },
      { start_date: "2026-11-01", end_date: "2026-11-10", status: "done" },
      { start_date: "2026-11-03", end_date: "2026-11-03", status: "not_started", kind: "milestone" },
    ]);
    expect(counts.get("2026-11-01")).toBe(1);
    expect(counts.get("2026-11-03")).toBe(2);
    expect(counts.get("2026-11-05")).toBeUndefined();
  });
});
