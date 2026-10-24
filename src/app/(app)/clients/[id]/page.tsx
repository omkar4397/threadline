import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadStages } from "@/lib/data";
import { ClientDetail } from "@/components/clients/client-detail";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: projects }, stages, { data: allClients }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("*").eq("client_id", id).order("delivery_date"),
    loadStages(),
    supabase.from("clients").select("id").order("created_at"),
  ]);
  if (!client) notFound();

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: tasks } = projectIds.length
    ? await supabase.from("tasks").select("*").in("project_id", projectIds)
    : { data: [] };
  const colorIndex = (allClients ?? []).findIndex((c) => c.id === id);

  return <ClientDetail client={client} colorIndex={colorIndex} projects={projects ?? []} tasks={tasks ?? []} stages={stages} />;
}
