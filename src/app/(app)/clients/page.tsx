import type { Metadata } from "next";
import { loadPlanningData } from "@/lib/data";
import { ClientsList } from "@/components/clients/clients-list";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { clients, projects, tasks } = await loadPlanningData();
  return <ClientsList clients={clients} projects={projects} tasks={tasks} />;
}
