"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { formatLong } from "@/lib/dates";
import { categoryKey, filterExpenses, formatMoney, payeeKey, totalOf, totalsBy } from "@/lib/expenses";
import type { Designer, Expense, ExpenseCategory, Task, Vendor } from "@/lib/types";
import { BarList } from "./bar-list";
import { ExpenseSheet } from "./expense-sheet";
import { categoryLabel, payeeKind, payeeLabel } from "./labels";

type Breakdown = "category" | "payee";

export function ExpensesSection({
  projectId,
  expenses,
  categories,
  tasks,
  vendors,
  designers,
}: {
  projectId: string;
  expenses: Expense[];
  categories: ExpenseCategory[];
  tasks: Task[];
  vendors: Vendor[];
  designers: Designer[];
}) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState("");
  const [payee, setPayee] = useState("");
  const [breakdown, setBreakdown] = useState<Breakdown>("category");

  const total = totalOf(expenses);
  // Each breakdown honours the other filter, so the bars always add up to what the list shows.
  const byCategory = totalsBy(filterExpenses(expenses, { payee }, categories), (e) => categoryKey(e, categories)).map((g) => ({
    ...g,
    label: categoryLabel(g.key, categories),
  }));
  const byPayee = totalsBy(filterExpenses(expenses, { category }, categories), payeeKey).map((g) => ({
    ...g,
    label: payeeLabel(g.key, vendors, designers),
    sublabel: payeeKind(g.key),
  }));
  const visible = filterExpenses(expenses, { category, payee }, categories).sort(
    (a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at),
  );
  const filtered = Boolean(category || payee);

  // Options only list what this project actually has.
  const categoryOptions = totalsBy(expenses, (e) => categoryKey(e, categories)).map((g) => ({ key: g.key, label: categoryLabel(g.key, categories) }));
  const payeeOptions = totalsBy(expenses, payeeKey).map((g) => ({ key: g.key, label: payeeLabel(g.key, vendors, designers) }));

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted">
            {expenses.length === 0
              ? "Nothing recorded yet"
              : filtered
                ? `Showing ${formatMoney(totalOf(visible))} of ${formatMoney(total)} · ${visible.length} of ${expenses.length} expenses`
                : `${formatMoney(total)} across ${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          + Add expense
        </Button>
      </div>

      {expenses.length > 0 ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-56">
              <option value="">All categories</option>
              {categoryOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by vendor or designer" value={payee} onChange={(e) => setPayee(e.target.value)} className="w-full sm:w-56">
              <option value="">All vendors &amp; designers</option>
              {payeeOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
            {filtered ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setCategory("");
                  setPayee("");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Card className="px-4 py-3">
              <div role="tablist" aria-label="Breakdown" className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
                {(["category", "payee"] as const).map((b) => (
                  <button
                    key={b}
                    role="tab"
                    type="button"
                    aria-selected={breakdown === b}
                    onClick={() => setBreakdown(b)}
                    className={`min-h-9 rounded-md text-sm font-medium ${breakdown === b ? "bg-surface shadow-sm" : "text-stone-500"}`}
                  >
                    {b === "category" ? "By category" : "By paid to"}
                  </button>
                ))}
              </div>
              {breakdown === "category" ? (
                <BarList items={byCategory} selected={category} onSelect={setCategory} />
              ) : (
                <BarList items={byPayee} selected={payee} onSelect={setPayee} />
              )}
              <p className="mt-1 text-xs text-muted">Tap a bar to filter the list.</p>
            </Card>
            <Card>
              {visible.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No expenses match these filters.</p> : null}
              <ul>
                {visible.map((e) => {
                  const stage = tasks.find((t) => t.id === e.task_id)?.stage_name;
                  const paidTo = payeeKey(e) === "none" ? null : payeeLabel(payeeKey(e), vendors, designers);
                  return (
                    <li key={e.id} className="border-b border-line last:border-0">
                      <button type="button" onClick={() => setEditing(e)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {categoryLabel(categoryKey(e, categories), categories)}
                            {e.description ? <span className="font-normal text-muted"> · {e.description}</span> : null}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {formatLong(e.spent_on)}
                            {paidTo ? ` · ${paidTo}` : ""}
                            {stage ? ` · ${stage}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      ) : null}

      <ExpenseSheet
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        projectId={projectId}
        expense={editing ?? undefined}
        tasks={tasks}
        categories={categories}
        vendors={vendors}
        designers={designers}
      />
    </section>
  );
}
