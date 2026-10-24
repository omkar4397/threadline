"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { addDays, diffDays, durationDays, formatLong, formatMonth, formatRange, toDayNumber, weekdayIndex } from "@/lib/dates";
import { activeTasksPerDay, describeRisk, type ProjectRisk } from "@/lib/scheduling";
import { PROJECT_STATUS_LABEL, STATUS_COLOR, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Client, Project, Task } from "@/lib/types";

export type Zoom = "week" | "month" | "quarter";
export type ColorMode = "client" | "status";

export type GanttProject = { project: Project; tasks: Task[]; risk: ProjectRisk };
export type GanttGroup = { client: Client; color: string; projects: GanttProject[] };

const PX_PER_DAY: Record<Zoom, number> = { week: 44, month: 16, quarter: 6 };
const BAR_HEIGHT = 28;
const LANE_GAP = 6;
const ROW_PADDING = 10;
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type DragMode = "move" | "start" | "end";
type DragState = { task: Task; mode: DragMode; originX: number; delta: number; moved: boolean };
type Override = { start: string; end: string; version: string };

export function Gantt({
  groups,
  colorMode,
  zoom,
  showLoad,
  showClientHeaders,
  today,
  onSelectTask,
  onMoveTask,
}: {
  groups: GanttGroup[];
  colorMode: ColorMode;
  zoom: Zoom;
  showLoad: boolean;
  showClientHeaders: boolean;
  today: string;
  onSelectTask: (task: Task) => void;
  onMoveTask: (task: Task, start: string, end: string) => Promise<boolean>;
}) {
  const px = PX_PER_DAY[zoom];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const suppressClick = useRef(false);

  const allTasks = useMemo(() => groups.flatMap((g) => g.projects.flatMap((p) => p.tasks)), [groups]);

  // Visible date range: a little before the earliest task (or today) through a
  // few weeks past the last end/delivery date, starting on a Monday so the
  // weekly grid lines line up.
  const range = useMemo(() => {
    const dates = [today, ...allTasks.flatMap((t) => [t.start_date, t.end_date]), ...groups.flatMap((g) => g.projects.map((p) => p.project.delivery_date))];
    const days = dates.map(toDayNumber);
    let start = addDays("1970-01-01", Math.min(...days) - 7);
    start = addDays(start, -weekdayIndex(start));
    const end = addDays("1970-01-01", Math.max(...days, toDayNumber(today) + 42) + 21);
    return { start, end, days: durationDays(start, end) };
  }, [allTasks, groups, today]);

  const width = range.days * px;
  const x = useCallback((iso: string) => diffDays(iso, range.start) * px, [range.start, px]);

  // Start scrolled so today is near the left edge.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, x(today) - px * 10);
  }, [zoom, x, today, px]);

  const load = useMemo(() => (showLoad ? activeTasksPerDay(allTasks) : null), [showLoad, allTasks]);

  // Drag to move / resize bars (mouse and trackpad only; touch uses the panel).
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.originX;
      const delta = Math.round(dx / px);
      setDrag((d) => (d ? { ...d, delta, moved: d.moved || Math.abs(dx) > 3 } : d));
    };
    const onUp = async () => {
      const d = drag;
      setDrag(null);
      if (!d.moved) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (d.delta === 0) return;
      const { start, end } = draggedDates(d);
      if (diffDays(end, start) < 0) return;
      setOverrides((o) => ({ ...o, [d.task.id]: { start, end, version: d.task.updated_at } }));
      const ok = await onMoveTask(d.task, start, end);
      if (!ok) {
        setOverrides((o) => {
          const next = { ...o };
          delete next[d.task.id];
          return next;
        });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, px, onMoveTask]);

  function datesFor(task: Task) {
    if (drag?.task.id === task.id && drag.moved) return draggedDates(drag);
    const o = overrides[task.id];
    if (o && o.version === task.updated_at) return { start: o.start, end: o.end };
    return { start: task.start_date, end: task.end_date };
  }

  const gridStyle: CSSProperties = {
    width,
    backgroundImage: [
      `repeating-linear-gradient(to right, var(--color-line) 0 1px, transparent 1px ${7 * px}px)`,
      zoom === "quarter" ? null : `repeating-linear-gradient(to right, transparent 0 ${5 * px}px, rgb(0 0 0 / 0.025) ${5 * px}px ${7 * px}px)`,
    ]
      .filter(Boolean)
      .join(", "),
  };

  const todayX = x(today);
  const todayLine = <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-accent/70" style={{ left: todayX + px / 2 - 1 }} aria-hidden />;

  return (
    <div ref={scrollRef} className="scrollbar-thin relative max-h-[calc(100dvh-15rem)] overflow-auto rounded-xl border border-line bg-surface md:max-h-[calc(100dvh-13rem)]">
      <div style={{ width: `calc(var(--label-w) + ${width}px)` }} className="[--label-w:8.5rem] md:[--label-w:14rem]">
        {/* Header ---------------------------------------------------------------- */}
        <div className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="flex">
            <div className="sticky left-0 z-40 w-(--label-w) shrink-0 border-r border-line bg-surface" />
            <div className="relative" style={{ width }}>
              <MonthRow start={range.start} days={range.days} px={px} />
              <DayRow start={range.start} days={range.days} px={px} zoom={zoom} today={today} />
              <div className="absolute z-10 -translate-x-1/2 rounded-b bg-accent px-1.5 text-[10px] font-semibold text-white" style={{ left: todayX + px / 2, top: 0 }}>
                Today
              </div>
            </div>
          </div>
          {load ? (
            <div className="flex border-t border-line">
              <div className="sticky left-0 z-40 flex w-(--label-w) shrink-0 items-center border-r border-line bg-surface px-3 text-xs font-medium text-muted">
                Overlap
              </div>
              <LoadRow start={range.start} days={range.days} px={px} load={load} />
            </div>
          ) : null}
        </div>

        {/* Rows ---------------------------------------------------------------- */}
        {groups.map((group) => (
          <div key={group.client.id}>
            {showClientHeaders ? (
              <div className="flex border-b border-line bg-stone-50">
                <div className="sticky left-0 z-20 flex min-h-9 w-(--label-w) shrink-0 items-center gap-2 border-r border-line bg-stone-50 px-3 text-sm font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: group.color }} />
                  <span className="truncate">{group.client.name}</span>
                </div>
                <div className="relative" style={{ width }}>
                  {todayLine}
                </div>
              </div>
            ) : null}
            {group.projects.map(({ project, tasks, risk }) => {
              const lanes = assignLanes(tasks.map((t) => ({ task: t, ...datesFor(t) })));
              const laneCount = Math.max(1, ...lanes.map((l) => l.lane + 1));
              const height = ROW_PADDING * 2 + laneCount * BAR_HEIGHT + (laneCount - 1) * LANE_GAP;
              const deliveryX = x(project.delivery_date) + px / 2;
              return (
                <div key={project.id} className="flex border-b border-line">
                  <div className="sticky left-0 z-20 flex w-(--label-w) shrink-0 flex-col justify-center border-r border-line bg-surface px-3 py-2">
                    <Link href={`/projects/${project.id}`} className="truncate text-sm font-medium hover:text-accent hover:underline" title={project.name}>
                      {project.name}
                    </Link>
                    <span className="truncate text-xs text-muted">
                      {project.status !== "active" ? `${PROJECT_STATUS_LABEL[project.status]} · ` : ""}Due {formatRange(project.delivery_date, project.delivery_date)}
                    </span>
                    {risk.atRisk ? (
                      <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-risk-soft px-2 py-0.5 text-[11px] font-semibold text-risk" title={risk.reasons.map(describeRisk).join("\n")}>
                        ⚠ At risk
                      </span>
                    ) : null}
                  </div>
                  <div className="relative" style={{ ...gridStyle, height }}>
                    {todayLine}
                    {lanes.map(({ task, start, end, lane }) => {
                      const left = x(start);
                      const barWidth = Math.max(px * durationDays(start, end) - 2, 4);
                      const colors = colorMode === "status" ? STATUS_COLOR[task.status] : { bg: group.color, text: "#fff" };
                      const overdue = task.status !== "done" && diffDays(task.end_date, today) < 0;
                      const isDragging = drag?.task.id === task.id && drag.moved;
                      const label = `${task.stage_name} · ${formatRange(start, end)}`;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          title={`${label}\n${TASK_STATUS_LABEL[task.status]}${overdue ? " · past end date" : ""}`}
                          className={`group absolute flex items-center overflow-hidden rounded-md text-left text-xs font-medium shadow-sm transition-[filter] select-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink md:cursor-grab ${isDragging ? "z-20 cursor-grabbing opacity-90 shadow-lg" : ""} ${overdue ? "ring-2 ring-risk ring-offset-1" : ""}`}
                          style={{
                            left: left + 1,
                            width: barWidth,
                            top: ROW_PADDING + lane * (BAR_HEIGHT + LANE_GAP),
                            height: BAR_HEIGHT,
                            background: colors.bg,
                            color: colors.text,
                            opacity: colorMode === "client" && task.status === "done" ? 0.45 : 1,
                          }}
                          onPointerDown={(e) => {
                            if (e.pointerType !== "mouse" || e.button !== 0) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offset = e.clientX - rect.left;
                            const edge = Math.min(8, rect.width / 4);
                            const mode: DragMode = offset < edge ? "start" : offset > rect.width - edge ? "end" : "move";
                            setDrag({ task, mode, originX: e.clientX, delta: 0, moved: false });
                          }}
                          onClick={() => {
                            if (suppressClick.current) return;
                            onSelectTask(task);
                          }}
                        >
                          <span className="absolute inset-y-0 left-0 hidden w-2 cursor-ew-resize md:block" aria-hidden />
                          <span className="truncate px-2">
                            {colorMode === "client" && task.status === "done" ? "✓ " : ""}
                            {colorMode === "client" && task.status === "in_progress" ? "● " : ""}
                            {barWidth > 36 ? label : ""}
                          </span>
                          <span className="absolute inset-y-0 right-0 hidden w-2 cursor-ew-resize md:block" aria-hidden />
                        </button>
                      );
                    })}
                    <div
                      className="absolute z-10 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: deliveryX, top: ROW_PADDING - 6 }}
                      title={`Delivery ${formatLong(project.delivery_date)}${risk.atRisk ? " · at risk" : ""}`}
                    >
                      <span className={`block size-3.5 rotate-45 border-2 border-white shadow ${risk.atRisk ? "bg-risk" : "bg-ink"}`} />
                    </div>
                    <div
                      className={`pointer-events-none absolute inset-y-0 w-px ${risk.atRisk ? "bg-risk/60" : "bg-ink/30"}`}
                      style={{ left: deliveryX }}
                      aria-hidden
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function draggedDates(d: DragState) {
  const { task, mode, delta } = d;
  return {
    start: mode === "end" ? task.start_date : addDays(task.start_date, delta),
    end: mode === "start" ? task.end_date : addDays(task.end_date, delta),
  };
}

/** Stack overlapping bars into separate lanes within a project row. */
function assignLanes<T extends { start: string; end: string; task: Task }>(items: T[]) {
  const sorted = [...items].sort((a, b) => diffDays(a.start, b.start) || a.task.sort_order - b.task.sort_order);
  const laneEnds: string[] = [];
  return sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => diffDays(item.start, end) > 0);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { ...item, lane };
  });
}

function MonthRow({ start, days, px }: { start: string; days: number; px: number }) {
  const months: { iso: string; offset: number; length: number }[] = [];
  for (let i = 0; i < days; ) {
    const iso = addDays(start, i);
    const [y, m] = iso.split("-").map(Number);
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const length = Math.min(diffDays(next, iso), days - i);
    months.push({ iso, offset: i, length });
    i += length;
  }
  return (
    <div className="relative h-7">
      {months.map((m) => (
        <div key={m.iso} className="absolute inset-y-0 border-l border-line px-2 pt-1.5 text-xs font-semibold whitespace-nowrap text-ink" style={{ left: m.offset * px, width: m.length * px }}>
          <span className="sticky left-[calc(var(--label-w)+0.5rem)]">{m.length * px > 50 ? formatMonth(m.iso) : ""}</span>
        </div>
      ))}
    </div>
  );
}

function DayRow({ start, days, px, zoom, today }: { start: string; days: number; px: number; zoom: Zoom; today: string }) {
  const cells = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i);
    const weekday = i % 7;
    const day = Number(iso.slice(8));
    const isToday = iso === today;
    if (zoom === "week") {
      cells.push(
        <div key={iso} className={`absolute inset-y-0 flex flex-col items-center justify-center text-[10px] leading-tight ${isToday ? "font-bold text-accent" : weekday >= 5 ? "text-stone-400" : "text-muted"}`} style={{ left: i * px, width: px }}>
          <span>{WEEKDAY_LETTERS[weekday]}</span>
          <span className="text-xs">{day}</span>
        </div>,
      );
    } else if (weekday === 0) {
      cells.push(
        <div key={iso} className="absolute inset-y-0 border-l border-line pl-1 pt-1 text-[10px] text-muted" style={{ left: i * px, width: 7 * px }}>
          {zoom === "month" ? day : ""}
        </div>,
      );
    }
  }
  return <div className={`relative ${zoom === "week" ? "h-9" : "h-5"}`}>{cells}</div>;
}

function LoadRow({ start, days, px, load }: { start: string; days: number; px: number; load: Map<string, number> }) {
  const max = Math.max(1, ...load.values());
  const cells = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i);
    const count = load.get(iso) ?? 0;
    if (count === 0) continue;
    const intensity = count / max;
    cells.push(
      <div
        key={iso}
        className="absolute inset-y-1 flex items-center justify-center rounded-sm text-[10px] font-semibold"
        style={{
          left: i * px,
          width: px,
          background: `color-mix(in oklab, var(--color-accent) ${Math.round(15 + intensity * 75)}%, transparent)`,
          color: intensity > 0.5 ? "#fff" : "var(--color-accent-strong)",
        }}
        title={`${formatLong(iso)}: ${count} task${count === 1 ? "" : "s"} running`}
      >
        {px >= 14 ? count : ""}
      </div>,
    );
  }
  return (
    <div className="relative h-8" style={{ width: days * px }}>
      {cells}
    </div>
  );
}
