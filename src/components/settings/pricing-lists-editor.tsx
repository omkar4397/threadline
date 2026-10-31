"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteRow, insertRow, updateRow } from "@/lib/mutations";
import { findCategoryByName } from "@/lib/expenses";
import { DETAIL_LABEL, PRICING_UNITS, UNIT_LABEL, type PricingDetail, type PricingUnit } from "@/lib/pricing";
import { errorMessage } from "@/lib/form";
import type { PricingItemType, PricingProduct } from "@/lib/types";

type Item = { id: string; name: string; default_unit: PricingUnit; detail?: PricingDetail };
type Draft = { name: string; unit: PricingUnit; detail: PricingDetail };

/** Item types and products used by pricing lines: rename, change the usual unit, add, delete when unused. */
export function PricingListsEditor({
  itemTypes,
  products,
  typeUsage,
  productUsage,
}: {
  itemTypes: PricingItemType[];
  products: PricingProduct[];
  typeUsage: Record<string, number>;
  productUsage: Record<string, number>;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold">Item types</h3>
        <p className="mb-3 text-sm text-muted">What a pricing line is for. The extra detail asks for a free-text name (like the fabric) or a product from the list below.</p>
        <ListEditor table="pricing_item_types" items={itemTypes} usage={typeUsage} withDetail />
      </div>
      <div>
        <h3 className="font-semibold">Products</h3>
        <p className="mb-3 text-sm text-muted">Used by Sampling and Production lines. The unit is a default you can change on each line.</p>
        <ListEditor table="pricing_products" items={products} usage={productUsage} />
      </div>
    </div>
  );
}

function ListEditor({ table, items, usage, withDetail = false }: { table: "pricing_item_types" | "pricing_products"; items: Item[]; usage: Record<string, number>; withDetail?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const initial = Object.fromEntries(items.map((i) => [i.id, { name: i.name, unit: i.default_unit, detail: i.detail ?? "none" }])) as Record<string, Draft>;
  const [drafts, setDrafts] = useState(initial);
  const [fresh, setFresh] = useState<Draft>({ name: "", unit: "piece", detail: "none" });
  const [pending, setPending] = useState(false);
  const noun = table === "pricing_item_types" ? "item type" : "product";

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await action();
      toast(success);
      router.refresh();
      return true;
    } catch (err) {
      toast(errorMessage(err), "error");
      return false;
    } finally {
      setPending(false);
    }
  }

  function check(name: string, exceptId?: string) {
    if (!name) return "Names can’t be empty.";
    const clash = findCategoryByName(items, name);
    if (clash && clash.id !== exceptId) return `“${clash.name}” already exists.`;
    return null;
  }

  async function save(item: Item) {
    const d = drafts[item.id];
    const name = d.name.trim().replace(/\s+/g, " ");
    const problem = check(name, item.id);
    if (problem) return toast(problem, "error");
    await run(() => updateRow(table, item.id, withDetail ? { name, default_unit: d.unit, detail: d.detail } : { name, default_unit: d.unit }), "Saved");
  }

  async function remove(item: Item) {
    if (usage[item.id]) {
      return toast(`“${item.name}” is used on ${usage[item.id]} pricing line${usage[item.id] === 1 ? "" : "s"}, so it can’t be deleted. Rename it instead.`, "error");
    }
    const ok = await confirm({ title: `Delete “${item.name}”?`, message: `This ${noun} isn’t used on any pricing line.`, choices: [{ value: "delete", label: "Delete", variant: "danger" }] });
    if (ok) await run(() => deleteRow(table, item.id), "Deleted");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = fresh.name.trim().replace(/\s+/g, " ");
    const problem = check(name);
    if (problem) return toast(problem, "error");
    const values = withDetail ? { name, default_unit: fresh.unit, detail: fresh.detail } : { name, default_unit: fresh.unit };
    if (await run(() => insertRow(table, values as never), `${noun[0].toUpperCase()}${noun.slice(1)} added`)) setFresh({ name: "", unit: "piece", detail: "none" });
  }

  const unitSelect = (value: PricingUnit, onChange: (u: PricingUnit) => void, label: string) => (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as PricingUnit)} className="w-full sm:w-40">
      {PRICING_UNITS.filter((u) => withDetail || u !== "flat").map((u) => (
        <option key={u} value={u}>
          {u === "flat" ? "Flat amount" : UNIT_LABEL[u].per}
        </option>
      ))}
    </Select>
  );
  const detailSelect = (value: PricingDetail, onChange: (d: PricingDetail) => void, label: string) => (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as PricingDetail)} className="w-full sm:w-56">
      {(["none", "text", "product"] as const).map((d) => (
        <option key={d} value={d}>
          {DETAIL_LABEL[d]}
        </option>
      ))}
    </Select>
  );

  return (
    <>
      <Card>
        <ul>
          {items.map((item) => {
            const d = drafts[item.id];
            const changed = d.name.trim() !== item.name || d.unit !== item.default_unit || (withDetail && d.detail !== item.detail);
            const set = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [item.id]: { ...all[item.id], ...patch } }));
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 last:border-0 sm:flex-nowrap">
                <Input aria-label={`Name of ${item.name}`} value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} className="min-w-0 flex-1 basis-full sm:basis-auto" />
                {unitSelect(d.unit, (unit) => set({ unit }), `Unit for ${item.name}`)}
                {withDetail ? detailSelect(d.detail, (detail) => set({ detail }), `Extra detail for ${item.name}`) : null}
                <span className="hidden w-16 shrink-0 text-right text-xs text-muted sm:inline">{usage[item.id] ? `${usage[item.id]} line${usage[item.id] === 1 ? "" : "s"}` : "unused"}</span>
                {changed ? (
                  <Button variant="primary" onClick={() => save(item)} disabled={pending}>
                    Save
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={pending}
                    aria-label={`Delete ${item.name}`}
                    title="Delete"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 sm:flex-nowrap">
        <Input aria-label={`New ${noun} name`} placeholder={`New ${noun}`} value={fresh.name} onChange={(e) => setFresh((f) => ({ ...f, name: e.target.value }))} maxLength={60} className="min-w-0 flex-1 basis-full sm:basis-auto" />
        {unitSelect(fresh.unit, (unit) => setFresh((f) => ({ ...f, unit })), `Unit for new ${noun}`)}
        {withDetail ? detailSelect(fresh.detail, (detail) => setFresh((f) => ({ ...f, detail })), `Extra detail for new ${noun}`) : null}
        <Button type="submit" disabled={pending || !fresh.name.trim()} className="shrink-0 whitespace-nowrap">
          + Add
        </Button>
      </form>
    </>
  );
}
