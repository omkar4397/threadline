"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, Stars } from "@/components/ui/misc";
import { VENDOR_TYPES, VENDOR_TYPE_LABEL, type VendorType } from "@/lib/labels";
import type { Designer, Vendor } from "@/lib/types";
import { DesignerFormSheet, VendorFormSheet } from "./partner-forms";

type Tab = "vendors" | "designers";

export function PartnersView({
  vendors,
  designers,
  openTasks,
  tab: initialTab,
}: {
  vendors: Vendor[];
  designers: Designer[];
  openTasks: { vendor_id: string | null; designer_id: string | null }[];
  tab: Tab;
}) {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<VendorType | "all">("all");
  const [adding, setAdding] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));

  function setTab(next: Tab) {
    setTabState(next);
    window.history.replaceState(null, "", next === "vendors" ? "/partners" : "/partners?tab=designers");
  }

  const vendorList = vendors.filter((v) => (type === "all" || v.type === type) && matches(v.name, v.contact_person, v.location, v.specialty));
  const designerList = designers.filter((d) => matches(d.name, d.contact_person, d.specialty));
  const openCount = (key: "vendor_id" | "designer_id", id: string) => openTasks.filter((t) => t[key] === id).length;

  return (
    <>
      <PageHeader
        title="Vendors & Designers"
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            + New {tab === "vendors" ? "vendor" : "designer"}
          </Button>
        }
      />
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-accent-soft/70 p-1 sm:inline-grid">
        {(["vendors", "designers"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-full px-6 text-sm font-medium ${tab === t ? "bg-surface shadow-soft" : "text-stone-500"}`}
          >
            {t === "vendors" ? `Vendors (${vendors.length})` : `Designers (${designers.length})`}
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <Input type="search" placeholder={`Search ${tab}`} value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        {tab === "vendors" ? (
          <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {(["all", ...VENDOR_TYPES] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${type === t ? "border-ink bg-ink text-white" : "border-line bg-surface text-stone-600"}`}
              >
                {t === "all" ? "All types" : VENDOR_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "vendors" ? (
        vendorList.length === 0 ? (
          <EmptyState title={vendors.length === 0 ? "No vendors yet" : "No matching vendors"}>{vendors.length === 0 ? "Add fabric suppliers, printers, manufacturers and shippers." : null}</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {vendorList.map((v) => (
              <PartnerCard
                key={v.id}
                href={`/partners/vendors/${v.id}`}
                name={v.name}
                lines={[VENDOR_TYPE_LABEL[v.type], v.location, v.specialty]}
                lead={v.typical_lead_days}
                rating={v.rating}
                open={openCount("vendor_id", v.id)}
              />
            ))}
          </div>
        )
      ) : designerList.length === 0 ? (
        <EmptyState title={designers.length === 0 ? "No designers yet" : "No matching designers"} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {designerList.map((d) => (
            <PartnerCard
              key={d.id}
              href={`/partners/designers/${d.id}`}
              name={d.name}
              lines={[d.specialty, d.rate]}
              lead={d.typical_lead_days}
              rating={d.rating}
              open={openCount("designer_id", d.id)}
            />
          ))}
        </div>
      )}

      {tab === "vendors" ? <VendorFormSheet open={adding} onClose={() => setAdding(false)} /> : <DesignerFormSheet open={adding} onClose={() => setAdding(false)} />}
    </>
  );
}

function PartnerCard({ href, name, lines, lead, rating, open }: { href: string; name: string; lines: (string | null)[]; lead: number | null; rating: number | null; open: number }) {
  return (
    <Link href={href}>
      <Card className="h-full px-4 py-3 hover:border-stone-300">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{name}</span>
          <Stars rating={rating} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">{lines.filter(Boolean).join(" · ") || "—"}</p>
        <p className="mt-2 text-xs text-stone-600">
          {lead ? `${lead}-day lead time` : "No lead time set"} · {open} open task{open === 1 ? "" : "s"}
        </p>
      </Card>
    </Link>
  );
}
