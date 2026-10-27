"use client";

import Link from "next/link";
import { useState } from "react";
import { diffDays, formatLong, formatRange } from "@/lib/dates";
import { describeRisk } from "@/lib/scheduling";
import { STATUS_COLOR, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Task, TaskContext } from "@/lib/types";
import type { ColorMode, GanttGroup } from "@/components/gantt/gantt";

type Item =
  | { kind: "task"; task: Task; color: string; projectName: string; clientName: string }
  | { kind: "delivery"; projectId: string; projectName: string; clientName: string; color: string; atRisk: boolean; riskText: string };

/** Tasks and deliveries grouped by date: overdue first, then today, then upcoming days. */
export function TimelineList({
  groups,
  colorMode,
  today,
  context,
  onSelectTask,
}: {
  groups: GanttGroup[];
  colorMode: ColorMode;
  today: string;
  context: TaskContext;
  onSelectTask: (task: Task) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const buckets = new Map<string, Item[]>();
  const add = (key: string, item: Item) => buckets.set(key, [...(buckets.get(key) ?? []), item]);

  for (const g of groups) {
    for (const { project, tasks, risk } of g.projects) {
      for (const task of tasks) {
        if (task.status === "done" && !showDone) continue;
        const color = colorMode === "status" ? STATUS_COLOR[task.status].bg : g.color;
        const item: Item = { kind: "task", task, color, projectName: project.name, clientName: g.client.name };
        if (task.status !== "done" && diffDays(task.end_date, today) < 0) add("overdue", item);
        else add(diffDays(task.start_date, today) < 0 ? (diffDays(task.end_date, today) >= 0 ? today : task.start_date) : task.start_date, item);
      }
      if (project.status !== "completed" && diffDays(project.delivery_date, today) >= 0) {
        add(project.delivery_date, {
          kind: "delivery",
          projectId: project.id,
          projectName: project.name,
          clientName: g.client.name,
          color: g.color,
          atRisk: risk.atRisk,
          riskText: risk.reasons.map(describeRisk).join(" · "),
        });
      }
    }
  }

  const keys = [...buckets.keys()].sort((a, b) => (a === "overdue" ? -1 : b === "overdue" ? 1 : diffDays(a, b)));
  const assigneeName = (t: Task) =>
    [context.vendors.find((v) => v.id === t.vendor_id)?.name, context.designers.find((d) => d.id === t.designer_id)?.name].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      <label className="flex min-h-11 items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-(--color-accent)" />
        Show finished tasks
      </label>
      {keys.map((key) => (
        <section key={key}>
          <h2 className={`sticky top-0 z-10 -mx-4 bg-canvas/95 px-4 py-2 text-sm font-semibold backdrop-blur md:mx-0 md:px-0 ${key === "overdue" ? "text-risk" : ""}`}>
            {key === "overdue" ? "Past end date" : key === today ? `Today · ${formatLong(key)}` : formatLong(key)}
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-surface shadow-soft">
            {buckets.get(key)!.map((item) =>
              item.kind === "task" ? (
                <li key={item.task.id} className="border-b border-line last:border-0">
                  <button type="button" onClick={() => onSelectTask(item.task)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.task.stage_name}</span>
                      <span className="block truncate text-xs text-muted">
                        {item.projectName} · {item.clientName}
                        {assigneeName(item.task) ? ` · ${assigneeName(item.task)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      <span className="block text-stone-600">{formatRange(item.task.start_date, item.task.end_date)}</span>
                      <span className="block text-muted">{TASK_STATUS_LABEL[item.task.status]}</span>
                    </span>
                  </button>
                </li>
              ) : (
                <li key={`delivery-${item.projectId}`} className="border-b border-line last:border-0">
                  <Link href={`/projects/${item.projectId}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <span className={`ml-0.5 size-3 shrink-0 rotate-45 ${item.atRisk ? "bg-risk" : "bg-ink"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">Delivery · {item.projectName}</span>
                      <span className={`block truncate text-xs ${item.atRisk ? "text-risk" : "text-muted"}`}>
                        {item.clientName}
                        {item.atRisk ? ` · ⚠ ${item.riskText}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
      {keys.length === 0 ? <p className="text-sm text-muted">Nothing scheduled.</p> : null}
    </div>
  );
}
