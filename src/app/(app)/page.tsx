import type { Metadata } from "next";
import { loadPlanningData } from "@/lib/data";
import { TimelineView } from "@/components/timeline/timeline-view";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({ searchParams }: PageProps<"/">) {
  const { client } = await searchParams;
  const data = await loadPlanningData();
  return <TimelineView {...data} selectedClientId={typeof client === "string" ? client : null} />;
}
