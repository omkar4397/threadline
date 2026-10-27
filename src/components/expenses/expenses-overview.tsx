"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { addDays, formatLong, formatMonth, todayISO } from "@/lib/dates";
import { categoryKey, filterExpenses, formatMoney, monthlyTotals, payeeKey, toCsv, totalOf, totalsBy } from "@/lib/expenses";
import type { Client, Designer, Expense, ExpenseCategory, Project, Vendor } from "@/lib/types";
import { BarList } from "./bar-list";
import { categoryLabel, payeeKind, payeeLabel } from "./labels";

type Period = "month" | "3months" | "year" | "12months" | "all" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "year", label: "This year" },
  { value: "12months", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
];

function periodRange(period: Period, today: string, custom: { from: string; to: string }) {
  const month = today.slice(0, 7);
  const monthsBack = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 - n, 1));
    return d.toISOString().slice(0, 10);
  };
  switch (period) {
    case "month":
      return { from: `${month}-01`, to: today };
    case "3months":
      return { from: monthsBack(2), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "12months":
      return { from: monthsBack(11), to: today };
    case "custom":
      return { from: custom.from, to: custom.to };
    default:
      return { from: "", to: "" };
  }
}

export function ExpensesOverview({
  expenses,
  projects,
  clients,
  categories,
  vendors,
  designers,
}: {
  expenses: Expense[];
  projects: Project[];
  clients: Client[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  designers: Designer[];
}) {
  const today = todayISO();
  const [period, setPeriod] = useState<Period>("year");
  const [custom, setCustom] = useState({ from: addDays(today, -30), to: today });
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("");
  const [payee, setPayee] = useState("");
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const range = periodRange(period, today, custom);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const clientOf = (pid: string) => clientById.get(projectById.get(pid)?.client_id ?? "");

  const scopeProjectIds = projectId ? [projectId] : clientId ? projects.filter((p) => p.client_id === clientId).map((p) => p.id) : undefined;
  const base = { from: range.from, to: range.to, projectIds: scopeProjectIds };
  const visible = filterExpenses(expenses, { ...base, category, payee }, categories);

  // Each breakdown ignores its own filter so it can be used to switch between values.
  const byCategory = totalsBy(filterExpenses(expenses, { ...base, payee }, categories), (e) => categoryKey(e, categories)).map((g) => ({
    ...g,
    label: categoryLabel(g.key, categories),
  }));
  const byPayee = totalsBy(filterExpenses(expenses, { ...base, category }, categories), payeeKey).map((g) => ({
    ...g,
    label: payeeLabel(g.key, vendors, designers),
    sublabel: payeeKind(g.key),
  }));
  const byProject = totalsBy(visible, (e) => e.project_id).map((g) => ({
    ...g,
    label: projectById.get(g.key)?.name ?? "Deleted project",
    sublabel: clientOf(g.key)?.name,
  }));
  const byClient = totalsBy(visible, (e) => clientOf(e.project_id)?.id ?? "none").map((g) => ({
    ...g,
    label: clientById.get(g.key)?.name ?? "Unknown client",
  }));

  // Monthly trend across the period (or the data's span for "All time"), at most 24 months.
  const firstMonth = (range.from || visible.at(-1)?.spent_on || today).slice(0, 7);
  const lastMonth = (range.to || today).slice(0, 7);
  const months = firstMonth <= lastMonth ? monthlyTotals(visible, firstMonth, lastMonth).slice(-24) : [];
  const maxMonth = Math.max(0, ...months.map((m) => m.total));
  const readout = months.find((m) => m.month === hoverMonth) ?? months.at(-1);

  const total = totalOf(visible);
  const topCategory = byCategory[0];
  const filtered = Boolean(clientId || projectId || category || payee);
  const rows = showAll ? visible : visible.slice(0, 50);

  function clearFilters() {
    setClientId("");
    setProjectId("");
    setCategory("");
    setPayee("");
  }

  function downloadCsv() {
    const csv = toCsv([
      ["Date", "Client", "Project", "Category", "Paid to", "Notes", "Amount (INR)"],
      ...visible.map((e) => [
        e.spent_on,
        clientOf(e.project_id)?.name ?? "",
        projectById.get(e.project_id)?.name ?? "",
        categoryLabel(categoryKey(e, categories), categories),
        payeeKey(e) === "none" ? "" : payeeLabel(payeeKey(e), vendors, designers),
        e.description ?? "",
        Number(e.amount),
      ]),
    ]);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `threadline-expenses-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (expenses.length === 0) {
    return (
      <>
        <PageHeader title="Expenses" />
        <EmptyState title="No expenses yet">Add expenses from a project’s page. They’ll be summarised here across all projects.</EmptyState>
      </>
    );
  }

  const clientProjects = clientId ? projects.filter((p) => p.client_id === clientId) : projects;

  return (
    <>
      <PageHeader title="Expenses" subtitle="All projects" />

      <div className="mb-5 grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="col-span-2 w-full sm:w-44">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        {period === "custom" ? (
          <div className="col-span-2 grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Field label="From">
              <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="To">
              <Input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </div>
        ) : null}
        <Select
          aria-label="Client"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setProjectId("");
          }}
          className="w-full min-w-0 sm:w-48"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full min-w-0 sm:w-52">
          <option value="">All projects</option>
          {clientProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {clientId ? "" : ` · ${clientById.get(p.client_id)?.name ?? ""}`}
            </option>
          ))}
        </Select>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full min-w-0 sm:w-48">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </Select>
        <Select aria-label="Vendor or designer" value={payee} onChange={(e) => setPayee(e.target.value)} className="w-full min-w-0 sm:w-52">
          <option value="">All payees</option>
          {vendors.length ? (
            <optgroup label="Vendors">
              {vendors.map((v) => (
                <option key={v.id} value={`v:${v.id}`}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {designers.length ? (
            <optgroup label="Designers">
              {designers.map((d) => (
                <option key={d.id} value={`d:${d.id}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <option value="none">No vendor or designer</option>
        </Select>
        {filtered ? (
          <Button variant="ghost" onClick={clearFilters} className="col-span-2">
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total spent" value={formatMoney(total)} hero />
        <Stat label="Expenses" value={String(visible.length)} />
        <Stat label="Projects with spending" value={String(byProject.length)} />
        <Stat label="Largest category" value={topCategory ? topCategory.label : "—"} detail={topCategory ? formatMoney(topCategory.total) : undefined} />
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No expenses match these filters">Try a longer period or clear the filters.</EmptyState>
      ) : (
        <>
          {months.length > 1 ? (
            <Card className="mb-4 px-4 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Spend per month</h2>
                {readout ? (
                  <p className="text-sm" aria-live="polite">
                    <span className="text-muted">{formatMonth(`${readout.month}-01`)}: </span>
                    <span className="font-semibold tabular-nums">{formatMoney(readout.total)}</span>
                    <span className="text-muted">
                      {" "}
                      · {readout.count} expense{readout.count === 1 ? "" : "s"}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex h-44 items-end gap-1 border-b border-line" onMouseLeave={() => setHoverMonth(null)}>
                {months.map((m) => (
                  <button
                    key={m.month}
                    type="button"
                    onMouseEnter={() => setHoverMonth(m.month)}
                    onFocus={() => setHoverMonth(m.month)}
                    onClick={() => setHoverMonth(m.month)}
                    aria-label={`${formatMonth(`${m.month}-01`)}: ${formatMoney(m.total)}`}
                    className="group flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    <span
                      className={`block w-full max-w-10 rounded-t ${readout?.month === m.month ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/70"}`}
                      style={{ height: maxMonth > 0 ? `${Math.max(m.total > 0 ? 2 : 0, (m.total / maxMonth) * 100)}%` : 0 }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-1">
                {months.map((m, i) => (
                  <span key={m.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
                    {months.length <= 12 || i % 2 === 0 ? new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${m.month}-01T00:00:00Z`)) : ""}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <Card className="px-4 py-3">
              <h2 className="mb-1 font-semibold">By category</h2>
              <BarList items={byCategory} selected={category} onSelect={setCategory} />
            </Card>
            <Card className="px-4 py-3">
              <h2 className="mb-1 font-semibold">By vendor or designer</h2>
              <BarList items={byPayee} selected={payee} onSelect={setPayee} />
            </Card>
            <Card className="px-4 py-3">
              <h2 className="mb-1 font-semibold">By project</h2>
              <BarList items={byProject} selected={projectId} onSelect={setProjectId} />
            </Card>
            <Card className="px-4 py-3">
              <h2 className="mb-1 font-semibold">By client</h2>
              <BarList
                items={byClient}
                selected={clientId}
                onSelect={(key) => {
                  setClientId(key);
                  setProjectId("");
                }}
              />
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="font-semibold">
                {visible.length} expense{visible.length === 1 ? "" : "s"} · {formatMoney(total)}
              </h2>
              <Button onClick={downloadCsv}>Download CSV</Button>
            </div>
            <ul className="md:hidden">
              {rows.map((e) => (
                <li key={e.id} className="border-b border-line last:border-0">
                  <Link href={`/projects/${e.project_id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {categoryLabel(categoryKey(e, categories), categories)}
                        {e.description ? <span className="font-normal text-muted"> · {e.description}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {formatLong(e.spent_on)} · {projectById.get(e.project_id)?.name ?? "Deleted project"}
                        {payeeKey(e) === "none" ? "" : ` · ${payeeLabel(payeeKey(e), vendors, designers)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount))}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Paid to</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">{formatLong(e.spent_on)}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${e.project_id}`} className="font-medium hover:text-accent hover:underline">
                          {projectById.get(e.project_id)?.name ?? "Deleted project"}
                        </Link>
                        <span className="block text-xs text-muted">{clientOf(e.project_id)?.name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {categoryLabel(categoryKey(e, categories), categories)}
                        {e.description ? <span className="block max-w-xs truncate text-xs text-muted">{e.description}</span> : null}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">{payeeKey(e) === "none" ? "—" : payeeLabel(payeeKey(e), vendors, designers)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible.length > rows.length ? (
              <div className="border-t border-line px-4 py-2">
                <Button variant="ghost" onClick={() => setShowAll(true)}>
                  Show all {visible.length}
                </Button>
              </div>
            ) : null}
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, detail, hero }: { label: string; value: string; detail?: string; hero?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 truncate font-semibold tabular-nums ${hero ? "text-2xl" : "text-lg"}`} title={value}>
        {value}
      </p>
      {detail ? <p className="text-xs text-muted">{detail}</p> : null}
    </Card>
  );
}
