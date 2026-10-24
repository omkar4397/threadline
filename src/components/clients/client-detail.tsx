"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, DetailRow, EmptyState, PageHeader } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { ProjectBadges } from "@/components/projects/project-badges";
import { NewProjectSheet } from "@/components/projects/new-project";
import { deleteRow, updateRow } from "@/lib/mutations";
import { formatLong, todayISO } from "@/lib/dates";
import { assessProjectRisk } from "@/lib/scheduling";
import { clientColor } from "@/lib/labels";
import { errorMessage } from "@/lib/form";
import type { Client, Project, Stage, Task } from "@/lib/types";
import { ClientFormSheet } from "./client-form";

export function ClientDetail({ client, colorIndex, projects, tasks, stages }: { client: Client; colorIndex: number; projects: Project[]; tasks: Task[]; stages: Stage[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const today = todayISO();

  async function toggleArchive() {
    try {
      await updateRow("clients", client.id, { archived_at: client.archived_at ? null : new Date().toISOString() });
      toast(client.archived_at ? "Client restored" : "Client archived");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${client.name}?`,
      message: `This permanently deletes the client and their ${projects.length} project${projects.length === 1 ? "" : "s"} with all tasks. Archiving keeps the history instead.`,
      choices: [{ value: "delete", label: "Delete permanently", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("clients", client.id);
      toast("Client deleted");
      router.push("/clients");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <Link href="/clients" className="mb-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
        ‹ Clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: clientColor(colorIndex) }} />
            {client.archived_at ? "Archived" : `${projects.filter((p) => p.status !== "completed").length} open projects`}
          </span>
        }
        actions={
          <>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            <Button onClick={toggleArchive}>{client.archived_at ? "Restore" : "Archive"}</Button>
            {!client.archived_at ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                + New project
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Projects</h2>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet">
              <p>Create a project, pick the stages it needs and how many days each takes. They’re scheduled back from the delivery date.</p>
              {!client.archived_at ? (
                <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary", "mt-4")}>
                  + New project
                </button>
              ) : null}
            </EmptyState>
          ) : (
            <Card>
              <ul>
                {projects.map((p) => {
                  const projectTasks = tasks.filter((t) => t.project_id === p.id);
                  const done = projectTasks.filter((t) => t.status === "done").length;
                  const risk = assessProjectRisk(p, projectTasks, today);
                  return (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link href={`/projects/${p.id}`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block text-xs text-muted">
                            Delivery {formatLong(p.delivery_date)} · {done}/{projectTasks.length} stages done
                          </span>
                        </span>
                        <ProjectBadges project={p} risk={risk} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
        <aside>
          <h2 className="mb-2 text-sm font-semibold text-muted">Contact</h2>
          <Card className="px-4 py-2">
            <dl>
              <DetailRow label="Contact person">{client.contact_person}</DetailRow>
              <DetailRow label="Phone">{client.phone ? <a className="text-accent" href={`tel:${client.phone}`}>{client.phone}</a> : null}</DetailRow>
              <DetailRow label="Email">{client.email ? <a className="text-accent" href={`mailto:${client.email}`}>{client.email}</a> : null}</DetailRow>
              <DetailRow label="Address">{client.address}</DetailRow>
              <DetailRow label="Notes">{client.notes ? <span className="whitespace-pre-wrap">{client.notes}</span> : null}</DetailRow>
            </dl>
            {!client.contact_person && !client.phone && !client.email && !client.address && !client.notes ? <p className="py-2 text-sm text-muted">No contact details yet.</p> : null}
          </Card>
          <Button variant="danger" className="mt-4 w-full" onClick={remove}>
            Delete client
          </Button>
        </aside>
      </div>

      <ClientFormSheet open={editing} onClose={() => setEditing(false)} client={client} />
      <NewProjectSheet open={creating} onClose={() => setCreating(false)} clientId={client.id} stages={stages} />
    </>
  );
}
