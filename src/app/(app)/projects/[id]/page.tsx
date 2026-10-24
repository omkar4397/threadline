import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPartners, loadStages } from "@/lib/data";
import { ProjectDetail } from "@/components/projects/project-detail";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: client }, { data: tasks }, { vendors, designers }, stages] = await Promise.all([
    supabase.from("clients").select("*").eq("id", project.client_id).single(),
    supabase.from("tasks").select("*").eq("project_id", id).order("sort_order"),
    loadPartners(),
    loadStages(),
  ]);
  if (!client) notFound();

  return (
    <ProjectDetail
      project={project}
      context={{ projects: [project], clients: [client], tasks: tasks ?? [], vendors, designers, stages }}
    />
  );
}
