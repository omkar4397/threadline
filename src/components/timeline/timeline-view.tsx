"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Gantt, type ColorMode, type GanttGroup, type Zoom } from "@/components/gantt/gantt";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { assessProjectRisk } from "@/lib/scheduling";
import { clientColor, clientTextColor, STATUS_COLOR, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Task, TaskContext } from "@/lib/types";
import { TimelineList } from "./timeline-list";

type View = "gantt" | "list";

const storageListeners = new Set<() => void>();

function subscribeToStorage(callback: () => void) {
  storageListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    storageListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Storage unavailable (private mode)
  }
}

/** A view preference remembered in this browser. */
function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[], phoneDefault?: T) {
  const stored = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(key) ?? (phoneDefault && window.matchMedia("(max-width: 639px)").matches ? phoneDefault : null),
    () => null,
  );
  const value = stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : initial;
  const update = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // ignore
      }
      storageListeners.forEach((l) => l());
    },
    [key],
  );
  return [value, update] as const;
}

export function TimelineView({ selectedClientId, ...context }: TaskContext & { selectedClientId: string | null }) {
  const { clients, projects, tasks } = context;
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = usePersistentState<View>("threadline.view", "gantt", ["gantt", "list"], "list");
  const [zoom, setZoom] = usePersistentState<Zoom>("threadline.zoom", "month", ["week", "month", "quarter"]);
  const [showLoad, setShowLoad] = usePersistentState<"on" | "off">("threadline.load", "off", ["on", "off"]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { saveTask } = useTaskActions(tasks);
  const today = todayISO();

  const activeClients = useMemo(() => clients.filter((c) => !c.archived_at), [clients]);
  const indexByClient = useMemo(() => new Map(clients.map((c, i) => [c.id, i])), [clients]);
  const selectedClient = activeClients.find((c) => c.id === selectedClientId) ?? null;
  const colorMode: ColorMode = selectedClient ? "status" : "client";

  const groups: GanttGroup[] = useMemo(() => {
    const visibleClients = selectedClient ? [selectedClient] : activeClients;
    return visibleClients
      .map((client) => ({
        client,
        color: clientColor(indexByClient.get(client.id)!),
        textColor: clientTextColor(indexByClient.get(client.id)!),
        projects: projects
          .filter((p) => p.client_id === client.id && (showCompleted || p.status !== "completed"))
          .map((project) => {
            const projectTasks = tasks.filter((t) => t.project_id === project.id).sort((a, b) => a.sort_order - b.sort_order);
            return { project, tasks: projectTasks, risk: assessProjectRisk(project, projectTasks, today) };
          }),
      }))
      .filter((g) => g.projects.length > 0);
  }, [selectedClient, activeClients, indexByClient, projects, tasks, showCompleted, today]);

  const atRiskCount = groups.reduce((n, g) => n + g.projects.filter((p) => p.risk.atRisk).length, 0);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const onMoveTask = useCallback((task: Task, start: string, end: string) => saveTask(task, { start_date: start, end_date: end }), [saveTask]);

  function selectClient(id: string) {
    router.replace(id ? `${pathname}?client=${id}` : pathname, { scroll: false });
  }

  if (activeClients.length === 0) {
    return (
      <>
        <h1 className="mb-5 text-3xl font-bold tracking-tight">Timeline</h1>
        <EmptyState title="No clients yet">
          <p>Add a client and create a project. Its tasks will appear here.</p>
          <Link href="/clients" className={buttonClass("primary", "mt-4")}>
            Go to Clients
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          {atRiskCount > 0 ? (
            <span className="rounded-full bg-risk-soft px-3 py-1.5 text-xs font-semibold text-risk">
              {atRiskCount} at risk
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Client" value={selectedClient?.id ?? ""} onChange={(e) => selectClient(e.target.value)} className="w-full sm:w-56">
            <option value="">All clients</option>
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "gantt", label: "Gantt" },
              { value: "list", label: "List" },
            ]}
          />
          {view === "gantt" ? (
            <>
              <Segmented
                label="Zoom"
                value={zoom}
                onChange={setZoom}
                options={[
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                  { value: "quarter", label: "Quarter" },
                ]}
              />
              <button
                type="button"
                aria-pressed={showLoad === "on"}
                onClick={() => setShowLoad(showLoad === "on" ? "off" : "on")}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold ${showLoad === "on" ? "bg-accent text-white shadow-soft" : "bg-surface text-stone-600 shadow-soft"}`}
              >
                Overlap
              </button>
            </>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 px-1 text-sm text-stone-600">
            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="size-4 accent-(--color-accent)" />
            Completed
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No projects to show">
          <p>{selectedClient ? `${selectedClient.name} has no ${showCompleted ? "" : "open "}projects yet.` : "Create a project from a client’s page."}</p>
          <Link href={selectedClient ? `/clients/${selectedClient.id}` : "/clients"} className={buttonClass("primary", "mt-4")}>
            {selectedClient ? `Open ${selectedClient.name}` : "Go to Clients"}
          </Link>
        </EmptyState>
      ) : view === "gantt" ? (
        <>
          <Gantt
            groups={groups}
            colorMode={colorMode}
            zoom={zoom}
            showLoad={showLoad === "on"}
            showClientHeaders={!selectedClient}
            today={today}
            onSelectTask={(t) => setSelectedTaskId(t.id)}
            onMoveTask={onMoveTask}
          />
          <Legend groups={groups} colorMode={colorMode} />
        </>
      ) : (
        <TimelineList groups={groups} colorMode={colorMode} today={today} context={context} onSelectTask={(t) => setSelectedTaskId(t.id)} />
      )}

      <TaskDetailPanel task={selectedTask} context={context} onClose={() => setSelectedTaskId(null)} />
    </>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-full bg-accent-soft/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-full px-3.5 text-sm ${value === o.value ? "bg-surface font-semibold text-ink shadow-soft" : "font-medium text-stone-500 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ groups, colorMode }: { groups: GanttGroup[]; colorMode: ColorMode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-600">
      {colorMode === "client"
        ? groups.map((g) => (
            <span key={g.client.id} className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: g.color }} />
              {g.client.name}
            </span>
          ))
        : TASK_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: STATUS_COLOR[s].bg }} />
              {TASK_STATUS_LABEL[s]}
            </span>
          ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px] bg-ink" /> Delivery
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px] bg-risk" /> Delivery at risk
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full ring-2 ring-risk" /> Past end date
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-accent" /> Today
      </span>
      {colorMode === "client" ? <span className="text-muted">● in progress · ✓ done (faded)</span> : null}
      <span className="hidden text-muted md:inline">Drag a bar to move it, or drag its edges to change the dates.</span>
    </div>
  );
}
