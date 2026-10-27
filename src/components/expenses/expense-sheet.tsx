"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteRow, insertRow, updateRow } from "@/lib/mutations";
import { findCategoryByName, formatMoney, parseAmount } from "@/lib/expenses";
import { formatRange, todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/form";
import { VENDOR_TYPE_LABEL } from "@/lib/labels";
import type { Designer, Expense, ExpenseCategory, Task, Vendor } from "@/lib/types";

const NEW_CATEGORY = "__new";

export type ExpenseSheetProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Edit this expense; otherwise a new one is added. */
  expense?: Expense;
  /** Pre-select a stage when adding from a stage. */
  defaultTaskId?: string;
  tasks: Task[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  designers: Designer[];
};

export function ExpenseSheet(props: ExpenseSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.expense ? "Edit expense" : "Add expense"}>
      {props.open ? <ExpenseForm key={props.expense?.id ?? "new"} {...props} /> : null}
    </Sheet>
  );
}

function payeeValue(vendorId: string | null, designerId: string | null) {
  return vendorId ? `v:${vendorId}` : designerId ? `d:${designerId}` : "";
}

function ExpenseForm({ onClose, projectId, expense, defaultTaskId, tasks, categories, vendors, designers }: ExpenseSheetProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const sortedTasks = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
  const initialTask = sortedTasks.find((t) => t.id === (expense?.task_id ?? defaultTaskId));

  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? todayISO());
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [taskId, setTaskId] = useState(initialTask?.id ?? "");
  const [payee, setPayee] = useState(
    expense ? payeeValue(expense.vendor_id, expense.designer_id) : payeeValue(initialTask?.vendor_id ?? null, initialTask?.designer_id ?? null),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const parsedAmount = parseAmount(amount);

  function chooseStage(id: string) {
    setTaskId(id);
    // Suggest the stage's vendor or designer as the payee when none is chosen yet.
    const task = sortedTasks.find((t) => t.id === id);
    if (!payee && task) setPayee(payeeValue(task.vendor_id, task.designer_id));
  }

  async function resolveCategory(): Promise<string | null> {
    if (categoryId !== NEW_CATEGORY) return categoryId || null;
    const name = newCategory.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Type a name for the new category.");
    if (name.length > 60) throw new Error("Category names can be up to 60 characters.");
    const existing = findCategoryByName(categories, name);
    if (existing) return existing.id;
    return insertRow("expense_categories", { name });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount === null) return setError("Enter an amount greater than zero, with up to 2 decimals.");
    setPending(true);
    setError(null);
    try {
      const values = {
        project_id: projectId,
        amount: parsedAmount,
        spent_on: spentOn,
        category_id: await resolveCategory(),
        task_id: taskId || null,
        vendor_id: payee.startsWith("v:") ? payee.slice(2) : null,
        designer_id: payee.startsWith("d:") ? payee.slice(2) : null,
        description: description.trim() || null,
      };
      if (expense) await updateRow("expenses", expense.id, values);
      else await insertRow("expenses", values);
      toast(expense ? "Expense saved" : `Added ${formatMoney(parsedAmount)}`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  async function remove() {
    if (!expense) return;
    const ok = await confirm({
      title: "Delete this expense?",
      message: `${formatMoney(Number(expense.amount))} will be removed from the project.`,
      choices: [{ value: "delete", label: "Delete expense", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("expenses", expense.id);
      toast("Expense deleted");
      router.refresh();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus={!expense} />
        </Field>
        <Field label="Date">
          <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
        </Field>
      </div>

      <Field label="Category">
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>+ New category…</option>
        </Select>
      </Field>
      {categoryId === NEW_CATEGORY ? (
        <Field label="New category name" hint="It’s added to your category list for next time.">
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={60} placeholder="e.g. Embroidery, Trims, Alterations" required autoFocus />
        </Field>
      ) : null}

      <Field label="Stage (optional)">
        <Select value={taskId} onChange={(e) => chooseStage(e.target.value)}>
          <option value="">Not linked to a stage</option>
          {sortedTasks.map((t, i) => (
            <option key={t.id} value={t.id}>
              {i + 1}. {t.stage_name} · {formatRange(t.start_date, t.end_date)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Paid to (optional)">
        <Select value={payee} onChange={(e) => setPayee(e.target.value)}>
          <option value="">Not linked to a vendor or designer</option>
          {vendors.length > 0 ? (
            <optgroup label="Vendors">
              {vendors.map((v) => (
                <option key={v.id} value={`v:${v.id}`}>
                  {v.name} · {VENDOR_TYPE_LABEL[v.type]}
                </option>
              ))}
            </optgroup>
          ) : null}
          {designers.length > 0 ? (
            <optgroup label="Designers">
              {designers.map((d) => (
                <option key={d.id} value={`d:${d.id}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </Field>

      <Field label="Notes">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g. 40 m silk georgette, invoice #1123" />
      </Field>

      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || parsedAmount === null}>
        {pending ? "Saving…" : expense ? "Save expense" : parsedAmount ? `Add ${formatMoney(parsedAmount)}` : "Add expense"}
      </Button>
      {expense ? (
        <button type="button" onClick={remove} className="min-h-11 w-full text-sm font-medium text-risk hover:underline">
          Delete expense
        </button>
      ) : null}
    </form>
  );
}
