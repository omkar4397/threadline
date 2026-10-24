"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ProjectBadges } from "@/components/projects/project-badges";
import { formatLong, todayISO } from "@/lib/dates";
import { assessProjectRisk } from "@/lib/scheduling";
import { clientColor } from "@/lib/labels";
import type { Client, Project, Task } from "@/lib/types";
import { ClientFormSheet } from "./client-form";

export function ClientsList({ clients, projects, tasks }: { clients: Client[]; projects: Project[]; tasks: Task[] }) {
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const today = todayISO();
  const q = query.trim().toLowerCase();

  const visible = clients
    .map((c, i) => ({ client: c, color: clientColor(i) }))
    .filter(({ client }) => (showArchived ? true : !client.archived_at))
    .filter(({ client }) => !q || [client.name, client.contact_person, client.email].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => Number(Boolean(a.client.archived_at)) - Number(Boolean(b.client.archived_at)) || a.client.name.localeCompare(b.client.name));

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.filter((c) => !c.archived_at).length} active`}
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            + New client
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="search" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-(--color-accent)" />
          Show archived
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={clients.length === 0 ? "No clients yet" : "No matching clients"}>
          {clients.length === 0 ? "Add your first client to start planning projects." : null}
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(({ client, color }) => {
            const clientProjects = projects.filter((p) => p.client_id === client.id);
            const open = clientProjects.filter((p) => p.status !== "completed");
            return (
              <Card key={client.id} className={client.archived_at ? "opacity-60" : ""}>
                <Link href={`/clients/${client.id}`} className="flex min-h-14 items-center gap-3 rounded-t-xl px-4 py-3 hover:bg-stone-50">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{client.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {client.archived_at ? "Archived · " : ""}
                      {open.length} open project{open.length === 1 ? "" : "s"}
                      {client.contact_person ? ` · ${client.contact_person}` : ""}
                    </span>
                  </span>
                  <span className="text-muted" aria-hidden>
                    ›
                  </span>
                </Link>
                {open.length > 0 ? (
                  <ul className="border-t border-line">
                    {open.map((p) => {
                      const risk = assessProjectRisk(p, tasks.filter((t) => t.project_id === p.id), today);
                      return (
                        <li key={p.id}>
                          <Link href={`/projects/${p.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-stone-50">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{p.name}</span>
                              <span className="block text-xs text-muted">Delivery {formatLong(p.delivery_date)}</span>
                            </span>
                            <ProjectBadges project={p} risk={risk} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
      <ClientFormSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
