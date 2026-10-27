import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAssignmentContext } from "@/lib/data";
import { PartnerDetail } from "@/components/partners/partner-detail";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params }: PageProps<"/partners/vendors/[id]">) {
  const { id } = await params;
  const { assigned, payments, categories, context } = await loadAssignmentContext("vendor_id", id);
  const vendor = context.vendors.find((v) => v.id === id);
  if (!vendor) notFound();
  return <PartnerDetail kind="vendor" partner={vendor} assigned={assigned} payments={payments} categories={categories} context={context} />;
}
