"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, DetailRow, EmptyState, PageHeader, Stars } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { deleteRow } from "@/lib/mutations";
import { diffDays, formatLong, formatRange, todayISO } from "@/lib/dates";
import { STATUS_COLOR, TASK_STATUS_LABEL, VENDOR_TYPE_LABEL } from "@/lib/labels";
import { errorMessage } from "@/lib/form";
import { formatMoney, totalOf } from "@/lib/expenses";
import type { Designer, Expense, ExpenseCategory, Task, TaskContext, Vendor } from "@/lib/types";
import { DesignerFormSheet, VendorFormSheet } from "./partner-forms";

type Shared = { assigned: Task[]; payments: Expense[]; categories: ExpenseCategory[]; context: TaskContext };
type Props = ({ kind: "vendor"; partner: Vendor } & Shared) | ({ kind: "designer"; partner: Designer } & Shared);

export function PartnerDetail(props: Props) {
  const { kind, partner, assigned, payments, categories, context } = props;
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const today = todayISO();

  const current = assigned.filter((t) => t.status !== "done");
  const finished = assigned.filter((t) => t.status === "done");
  const table = kind === "vendor" ? "vendors" : "designers";

  async function remove() {
    const ok = await confirm({
      title: `Delete ${partner.name}?`,
      message: assigned.length ? `They’ll be unassigned from ${assigned.length} task${assigned.length === 1 ? "" : "s"}. The tasks stay.` : "This can’t be undone.",
      choices: [{ value: "delete", label: "Delete", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow(table, partner.id);
      toast("Deleted");
      router.push(kind === "vendor" ? "/partners" : "/partners?tab=designers");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const taskRow = (task: Task) => {
    const project = context.projects.find((p) => p.id === task.project_id);
    const client = context.clients.find((c) => c.id === project?.client_id);
    const overdue = task.status !== "done" && diffDays(task.end_date, today) < 0;
    return (
      <li key={task.id} className="border-b border-line last:border-0">
        <button type="button" onClick={() => setSelectedTaskId(task.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[task.status].bg }} title={TASK_STATUS_LABEL[task.status]} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{task.stage_name}</span>
            <span className="block truncate text-xs text-muted">
              {project?.name} · {client?.name}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs">
            <span className={`block ${overdue ? "font-semibold text-risk" : "text-stone-600"}`}>{formatRange(task.start_date, task.end_date)}</span>
            <span className="block text-muted">{TASK_STATUS_LABEL[task.status]}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <Link href={kind === "vendor" ? "/partners" : "/partners?tab=designers"} className="mb-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ‹ {kind === "vendor" ? "Vendors" : "Designers"}
      </Link>
      <PageHeader
        title={partner.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {kind === "vendor" ? VENDOR_TYPE_LABEL[props.partner.type] : "Designer"}
            <Stars rating={partner.rating} />
          </span>
        }
        actions={<Button onClick={() => setEditing(true)}>Edit</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Current assignments ({current.length})</h2>
          {current.length === 0 ? (
            <EmptyState title="No open tasks">Assign {partner.name} to a task from the timeline or a project page.</EmptyState>
          ) : (
            <Card>
              <ul>{current.map(taskRow)}</ul>
            </Card>
          )}
          {finished.length > 0 ? (
            <div className="mt-4">
              <button type="button" onClick={() => setShowDone(!showDone)} className="min-h-11 text-sm font-medium text-muted hover:text-ink">
                {showDone ? "Hide" : "Show"} {finished.length} finished task{finished.length === 1 ? "" : "s"}
              </button>
              {showDone ? (
                <Card>
                  <ul>{finished.map(taskRow)}</ul>
                </Card>
              ) : null}
            </div>
          ) : null}

          <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">
            Payments{payments.length ? ` · ${formatMoney(totalOf(payments))} in total` : ""}
          </h2>
          {payments.length === 0 ? (
            <EmptyState title="No payments recorded">Add an expense on a project and choose {partner.name} under “Paid to”.</EmptyState>
          ) : (
            <Card>
              <ul>
                {payments.map((e) => {
                  const project = context.projects.find((p) => p.id === e.project_id);
                  const client = context.clients.find((c) => c.id === project?.client_id);
                  const category = categories.find((c) => c.id === e.category_id)?.name ?? "Uncategorised";
                  return (
                    <li key={e.id} className="border-b border-line last:border-0">
                      <Link href={`/projects/${e.project_id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-stone-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {category}
                            {e.description ? <span className="font-normal text-muted"> · {e.description}</span> : null}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {formatLong(e.spent_on)} · {project?.name} · {client?.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(Number(e.amount))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold text-muted">Details</h2>
          <Card className="px-4 py-2">
            <dl>
              <DetailRow label="Contact person">{partner.contact_person}</DetailRow>
              <DetailRow label="Phone">{partner.phone ? <a className="text-accent" href={`tel:${partner.phone}`}>{partner.phone}</a> : null}</DetailRow>
              <DetailRow label="Email">{partner.email ? <a className="text-accent" href={`mailto:${partner.email}`}>{partner.email}</a> : null}</DetailRow>
              {kind === "vendor" ? <DetailRow label="Location">{props.partner.location}</DetailRow> : null}
              <DetailRow label="Specialty">{partner.specialty}</DetailRow>
              <DetailRow label="Typical lead time">{partner.typical_lead_days ? `${partner.typical_lead_days} days` : null}</DetailRow>
              {kind === "vendor" ? (
                <>
                  <DetailRow label="Minimum order">{props.partner.minimum_order}</DetailRow>
                  <DetailRow label="Payment terms">{props.partner.payment_terms}</DetailRow>
                </>
              ) : (
                <>
                  <DetailRow label="Rate">{props.partner.rate}</DetailRow>
                  <DetailRow label="Portfolio">
                    {props.partner.portfolio_url ? (
                      <a className="text-accent underline" href={props.partner.portfolio_url} target="_blank" rel="noopener noreferrer">
                        Open portfolio ↗
                      </a>
                    ) : null}
                  </DetailRow>
                </>
              )}
              <DetailRow label="Notes">{partner.notes ? <span className="whitespace-pre-wrap">{partner.notes}</span> : null}</DetailRow>
            </dl>
          </Card>
          <Button variant="danger" className="mt-4 w-full" onClick={remove}>
            Delete {kind}
          </Button>
        </aside>
      </div>

      {kind === "vendor" ? (
        <VendorFormSheet open={editing} onClose={() => setEditing(false)} vendor={props.partner} />
      ) : (
        <DesignerFormSheet open={editing} onClose={() => setEditing(false)} designer={props.partner} />
      )}
      <TaskDetailPanel task={context.tasks.find((t) => t.id === selectedTaskId) ?? null} context={context} onClose={() => setSelectedTaskId(null)} />
    </>
  );
}
