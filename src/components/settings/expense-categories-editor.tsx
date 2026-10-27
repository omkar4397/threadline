"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteRow, insertRow, updateRow } from "@/lib/mutations";
import { findCategoryByName } from "@/lib/expenses";
import { errorMessage } from "@/lib/form";
import type { ExpenseCategory } from "@/lib/types";

export function ExpenseCategoriesEditor({ categories, usage }: { categories: ExpenseCategory[]; usage: Record<string, number> }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(categories.map((c) => [c.id, c.name])));
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await action();
      toast(success);
      router.refresh();
      return true;
    } catch (err) {
      toast(errorMessage(err), "error");
      return false;
    } finally {
      setPending(false);
    }
  }

  function validate(name: string, exceptId?: string) {
    if (!name) return "Category names can’t be empty.";
    if (name.length > 60) return "Category names can be up to 60 characters.";
    const clash = findCategoryByName(categories, name);
    if (clash && clash.id !== exceptId) return `“${clash.name}” already exists.`;
    return null;
  }

  async function rename(c: ExpenseCategory) {
    const name = (names[c.id] ?? "").trim().replace(/\s+/g, " ");
    const problem = validate(name, c.id);
    if (problem) return toast(problem, "error");
    await run(() => updateRow("expense_categories", c.id, { name }), "Category renamed");
  }

  async function remove(c: ExpenseCategory) {
    const used = usage[c.id] ?? 0;
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      message: used ? `${used} expense${used === 1 ? " uses" : "s use"} this category. ${used === 1 ? "It" : "They"} will be kept as Uncategorised.` : "No expenses use this category.",
      choices: [{ value: "delete", label: "Delete category", variant: "danger" }],
    });
    if (ok) await run(() => deleteRow("expense_categories", c.id), "Category deleted");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim().replace(/\s+/g, " ");
    const problem = validate(name);
    if (problem) return toast(problem, "error");
    if (await run(() => insertRow("expense_categories", { name }), "Category added")) setNewName("");
  }

  return (
    <>
      <Card>
        <ul>
          {categories.map((c) => {
            const changed = (names[c.id] ?? "").trim() !== c.name;
            return (
              <li key={c.id} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0">
                <Input aria-label={`Rename ${c.name}`} value={names[c.id] ?? ""} onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))} className="min-w-0 flex-1" maxLength={60} />
                <span className="hidden w-20 shrink-0 text-right text-xs text-muted sm:inline">
                  {usage[c.id] ? `${usage[c.id]} expense${usage[c.id] === 1 ? "" : "s"}` : "unused"}
                </span>
                {changed ? (
                  <Button variant="primary" onClick={() => rename(c)} disabled={pending}>
                    Save
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={pending}
                    aria-label={`Delete ${c.name}`}
                    title="Delete category"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {categories.length === 0 ? <p className="px-4 py-4 text-sm text-muted">No categories yet.</p> : null}
      </Card>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <Input aria-label="New category name" placeholder="New category, e.g. Embroidery" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} className="flex-1" />
        <Button type="submit" disabled={pending || !newName.trim()}>
          + Add
        </Button>
      </form>
    </>
  );
}
