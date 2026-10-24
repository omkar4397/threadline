import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Client, Designer, Project, Stage, Task, Vendor } from "@/lib/types";

// Every query below runs as the signed-in user, so RLS limits results to
// their own rows.

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function loadPlanningData() {
  const supabase = await createClient();
  const [clients, projects, tasks, vendors, designers, stages] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("projects").select("*").order("delivery_date"),
    supabase.from("tasks").select("*").order("sort_order"),
    supabase.from("vendors").select("*").order("name"),
    supabase.from("designers").select("*").order("name"),
    supabase.from("stage_templates").select("*").order("sort_order"),
  ]);
  return {
    clients: unwrap<Client[]>(clients),
    projects: unwrap<Project[]>(projects),
    tasks: unwrap<Task[]>(tasks),
    vendors: unwrap<Vendor[]>(vendors),
    designers: unwrap<Designer[]>(designers),
    stages: unwrap<Stage[]>(stages),
  };
}

export async function loadStages() {
  const supabase = await createClient();
  return unwrap<Stage[]>(await supabase.from("stage_templates").select("*").order("sort_order"));
}

export async function loadPartners() {
  const supabase = await createClient();
  const [vendors, designers] = await Promise.all([
    supabase.from("vendors").select("*").order("name"),
    supabase.from("designers").select("*").order("name"),
  ]);
  return { vendors: unwrap<Vendor[]>(vendors), designers: unwrap<Designer[]>(designers) };
}

/** Tasks assigned to a vendor or designer, with everything the task panel needs. */
export async function loadAssignmentContext(column: "vendor_id" | "designer_id", id: string) {
  const supabase = await createClient();
  const assigned = unwrap<Task[]>(await supabase.from("tasks").select("*").eq(column, id).order("start_date"));
  const projectIds = [...new Set(assigned.map((t) => t.project_id))];
  const [projects, projectTasks, partners, stages] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("*").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
    projectIds.length ? supabase.from("tasks").select("*").in("project_id", projectIds) : Promise.resolve({ data: [], error: null }),
    loadPartners(),
    loadStages(),
  ]);
  const projectRows = unwrap<Project[]>(projects);
  const clientIds = [...new Set(projectRows.map((p) => p.client_id))];
  const clients = clientIds.length ? unwrap<Client[]>(await supabase.from("clients").select("*").in("id", clientIds)) : [];
  return {
    assigned,
    context: {
      projects: projectRows,
      clients,
      tasks: unwrap<Task[]>(projectTasks),
      vendors: partners.vendors,
      designers: partners.designers,
      stages,
    },
  };
}
