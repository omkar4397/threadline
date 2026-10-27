import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAssignmentContext } from "@/lib/data";
import { PartnerDetail } from "@/components/partners/partner-detail";

export const metadata: Metadata = { title: "Designer" };

export default async function DesignerPage({ params }: PageProps<"/partners/designers/[id]">) {
  const { id } = await params;
  const { assigned, payments, categories, context } = await loadAssignmentContext("designer_id", id);
  const designer = context.designers.find((d) => d.id === id);
  if (!designer) notFound();
  return <PartnerDetail kind="designer" partner={designer} assigned={assigned} payments={payments} categories={categories} context={context} />;
}
