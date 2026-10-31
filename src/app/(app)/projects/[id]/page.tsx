import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadExpenseCategories, loadPartners, loadPricingLists, loadStages } from "@/lib/data";
import { getLatestRates } from "@/lib/fx-server";
import { ProjectDetail } from "@/components/projects/project-detail";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: client }, { data: tasks }, { data: expenses }, { vendors, designers }, stages, categories, pricingLists, { data: pricingLines }, { data: lockedRates }, { data: namedLines }, latest] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", project.client_id).single(),
      supabase.from("tasks").select("*").eq("project_id", id).order("sort_order"),
      supabase.from("expenses").select("*").eq("project_id", id).order("spent_on", { ascending: false }),
      loadPartners(),
      loadStages(),
      loadExpenseCategories(),
      loadPricingLists(),
      supabase.from("pricing_lines").select("*").eq("project_id", id).order("created_at"),
      supabase.from("project_fx_rates").select("*").eq("project_id", id),
      supabase.from("pricing_lines").select("detail").not("detail", "is", null),
      getLatestRates(),
    ]);
  // Names typed before (fabrics etc.), suggested when adding a line.
  const fabricNames = [...new Set((namedLines ?? []).map((l) => l.detail?.trim()).filter((n): n is string => Boolean(n)))].sort((a, b) => a.localeCompare(b));
  if (!client) notFound();

  return (
    <ProjectDetail
      project={project}
      context={{ projects: [project], clients: [client], tasks: tasks ?? [], expenses: expenses ?? [], vendors, designers, stages }}
      categories={categories}
      pricing={{
        lines: pricingLines ?? [],
        itemTypes: pricingLists.itemTypes,
        products: pricingLists.products,
        lockedRates: lockedRates ?? [],
        latest: latest ? { rates: latest.rates, fetchedAt: latest.fetchedAt, stale: latest.stale } : null,
        fabricNames,
      }}
    />
  );
}
