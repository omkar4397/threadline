"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { formatLong } from "@/lib/dates";
import { formatMoney, totalOf, totalsByCategory } from "@/lib/expenses";
import type { Designer, Expense, ExpenseCategory, Task, Vendor } from "@/lib/types";
import { ExpenseSheet } from "./expense-sheet";

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
  const total = totalOf(expenses);
  const byCategory = totalsByCategory(expenses, categories);
  const sorted = [...expenses].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted">
            {expenses.length === 0 ? "Nothing recorded yet" : `${formatMoney(total)} across ${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          + Add expense
        </Button>
      </div>

      {expenses.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="px-4 py-3">
            <h3 className="mb-2 text-sm font-semibold text-muted">By category</h3>
            <ul className="space-y-2.5">
              {byCategory.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(c.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (c.total / total) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <ul>
              {sorted.map((e) => {
                const category = categories.find((c) => c.id === e.category_id)?.name ?? "Uncategorised";
                const stage = tasks.find((t) => t.id === e.task_id)?.stage_name;
                const payee = vendors.find((v) => v.id === e.vendor_id)?.name ?? designers.find((d) => d.id === e.designer_id)?.name;
                return (
                  <li key={e.id} className="border-b border-line last:border-0">
                    <button type="button" onClick={() => setEditing(e)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {category}
                          {e.description ? <span className="font-normal text-muted"> · {e.description}</span> : null}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {formatLong(e.spent_on)}
                          {payee ? ` · ${payee}` : ""}
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
