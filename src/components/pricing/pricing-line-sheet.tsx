"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { deleteRow, insertRow, updateRow } from "@/lib/mutations";
import { findCategoryByName } from "@/lib/expenses";
import { formatCurrency, type RateMap } from "@/lib/fx";
import { DETAIL_LABEL, formatPct, lineFigures, PRICING_UNITS, UNIT_LABEL, type PricingDetail, type PricingUnit } from "@/lib/pricing";
import { errorMessage } from "@/lib/form";
import type { Designer, PricingItemType, PricingLine, PricingProduct, Vendor } from "@/lib/types";
import { CurrencySelect } from "./currency-select";
import { ensureLockedRate } from "./rate-lock";
import { parseRate, RateField } from "./rate-field";

const NEW = "__new";

export type PricingLineSheetProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  line?: PricingLine;
  defaultCurrency: string;
  itemTypes: PricingItemType[];
  products: PricingProduct[];
  fabricNames: string[];
  locked: RateMap;
  latest: RateMap | null;
  vendors: Vendor[];
  designers: Designer[];
};

export function PricingLineSheet(props: PricingLineSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.line ? "Edit pricing line" : "Add pricing line"}>
      {props.open ? <LineForm key={props.line?.id ?? "new"} {...props} /> : null}
    </Sheet>
  );
}

function num(value: string) {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function LineForm({ onClose, projectId, line, defaultCurrency, itemTypes, products, fabricNames, locked, latest, vendors, designers }: PricingLineSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const listId = useId();

  const [typeId, setTypeId] = useState(line?.item_type_id ?? itemTypes[0]?.id ?? NEW);
  const [newType, setNewType] = useState({ name: "", unit: "piece" as PricingUnit, detail: "none" as PricingDetail });
  const [productId, setProductId] = useState(line?.product_id ?? "");
  const [newProduct, setNewProduct] = useState({ name: "", unit: "piece" as PricingUnit });
  const [detail, setDetail] = useState(line?.detail ?? "");
  const [unit, setUnit] = useState<PricingUnit>(line?.unit ?? itemTypes[0]?.default_unit ?? "piece");
  const [quantity, setQuantity] = useState(line ? String(Number(line.quantity)) : "");
  const [vendorRate, setVendorRate] = useState(line ? String(Number(line.vendor_rate)) : "");
  const [clientRate, setClientRate] = useState(line ? String(Number(line.client_rate)) : "");
  const [currency, setCurrency] = useState(line?.client_currency ?? defaultCurrency);
  const [manualRate, setManualRate] = useState("");
  const [provider, setProvider] = useState(line?.vendor_id ? `v:${line.vendor_id}` : line?.designer_id ? `d:${line.designer_id}` : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const type = itemTypes.find((t) => t.id === typeId);
  const detailKind: PricingDetail = typeId === NEW ? newType.detail : (type?.detail ?? "none");
  const isFlat = unit === "flat";

  function chooseType(id: string) {
    setTypeId(id);
    const t = itemTypes.find((x) => x.id === id);
    if (t && t.detail !== "product") setUnit(t.default_unit);
    if (id === NEW) setUnit(newType.unit);
  }

  function chooseProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setUnit(p.default_unit);
    if (id === NEW) setUnit(newProduct.unit);
  }

  const qty = isFlat ? 1 : num(quantity);
  const vRate = num(vendorRate || "0");
  const cRate = num(clientRate || "0");
  const rates: RateMap = { ...(latest ?? {}), ...locked, ...(parseRate(manualRate) ? { [currency]: parseRate(manualRate)! } : {}) };
  const valid = qty > 0 && vRate >= 0 && cRate >= 0;
  const preview = valid ? lineFigures({ quantity: qty, unit, vendor_rate: vRate, client_rate: cRate, client_currency: currency }, rates) : null;
  const unitWord = isFlat ? "" : ` ${UNIT_LABEL[unit].per}`;

  async function resolveType() {
    if (typeId !== NEW) return typeId;
    const name = newType.name.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Type a name for the new item type.");
    const existing = findCategoryByName(itemTypes, name);
    if (existing) return existing.id;
    return insertRow("pricing_item_types", { name, default_unit: newType.unit, detail: newType.detail });
  }

  async function resolveProduct() {
    if (detailKind !== "product") return null;
    if (productId !== NEW) {
      if (!productId) throw new Error("Choose a product.");
      return productId;
    }
    const name = newProduct.name.trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Type a name for the new product.");
    const existing = findCategoryByName(products, name);
    if (existing) return existing.id;
    return insertRow("pricing_products", { name, default_unit: newProduct.unit });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Enter a quantity above zero and prices of zero or more.");
    setPending(true);
    setError(null);
    try {
      await ensureLockedRate({ projectId, currency, locked, latest, manualRate: parseRate(manualRate) });
      const values = {
        project_id: projectId,
        item_type_id: await resolveType(),
        product_id: await resolveProduct(),
        detail: detailKind === "text" ? detail.trim() || null : null,
        quantity: qty,
        unit,
        vendor_rate: vRate,
        client_rate: cRate,
        client_currency: currency,
        vendor_id: provider.startsWith("v:") ? provider.slice(2) : null,
        designer_id: provider.startsWith("d:") ? provider.slice(2) : null,
      };
      if (line) await updateRow("pricing_lines", line.id, values);
      else await insertRow("pricing_lines", values);
      toast(line ? "Line saved" : "Line added");
      router.refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  async function remove() {
    if (!line) return;
    const ok = await confirm({
      title: "Delete this line?",
      message: "It will be removed from this project’s pricing.",
      choices: [{ value: "delete", label: "Delete line", variant: "danger" }],
    });
    if (!ok) return;
    try {
      await deleteRow("pricing_lines", line.id);
      toast("Line deleted");
      router.refresh();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Item">
        <Select value={typeId} onChange={(e) => chooseType(e.target.value)}>
          {itemTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value={NEW}>+ New item type…</option>
        </Select>
      </Field>
      {typeId === NEW ? (
        <div className="space-y-3 rounded-3xl bg-stone-50 p-4">
          <Field label="New item type" hint="Added to your list for next time.">
            <Input value={newType.name} onChange={(e) => setNewType((t) => ({ ...t, name: e.target.value }))} maxLength={60} placeholder="e.g. Trims, Packaging, Embroidery" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Usual unit">
              <Select
                value={newType.unit}
                onChange={(e) => {
                  const u = e.target.value as PricingUnit;
                  setNewType((t) => ({ ...t, unit: u }));
                  setUnit(u);
                }}
              >
                {PRICING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u].per}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Extra detail">
              <Select value={newType.detail} onChange={(e) => setNewType((t) => ({ ...t, detail: e.target.value as PricingDetail }))}>
                {(["none", "text", "product"] as const).map((d) => (
                  <option key={d} value={d}>
                    {DETAIL_LABEL[d]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      ) : null}

      {detailKind === "text" ? (
        <Field label={type?.name === "Fabric cost" ? "Fabric" : "Name"} hint="Free text. Names you’ve used before are suggested.">
          <Input value={detail} onChange={(e) => setDetail(e.target.value)} list={listId} maxLength={120} placeholder="e.g. Silk georgette, Velvet" />
          <datalist id={listId}>
            {fabricNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
      ) : null}

      {detailKind === "product" ? (
        <>
          <Field label="Product">
            <Select value={productId} onChange={(e) => chooseProduct(e.target.value)} required>
              <option value="" disabled>
                Choose a product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {UNIT_LABEL[p.default_unit].per}
                </option>
              ))}
              <option value={NEW}>+ New product…</option>
            </Select>
          </Field>
          {productId === NEW ? (
            <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3 rounded-3xl bg-stone-50 p-4">
              <Field label="New product" hint="Added to your list for next time.">
                <Input value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} maxLength={60} placeholder="e.g. T-shirt" required />
              </Field>
              <Field label="Usual unit">
                <Select
                  value={newProduct.unit}
                  onChange={(e) => {
                    const u = e.target.value as PricingUnit;
                    setNewProduct((p) => ({ ...p, unit: u }));
                    setUnit(u);
                  }}
                >
                  {PRICING_UNITS.filter((u) => u !== "flat").map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u].one}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" hint="Change it for this line if needed.">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as PricingUnit)}>
            {PRICING_UNITS.map((u) => (
              <option key={u} value={u}>
                {u === "flat" ? "Flat amount" : UNIT_LABEL[u].per}
              </option>
            ))}
          </Select>
        </Field>
        {isFlat ? null : (
          <Field label={`Quantity (${UNIT_LABEL[unit].many})`}>
            <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
          </Field>
        )}
      </div>

      <Field label={`Vendor price${unitWord} (₹)`} hint="What the vendor, designer or shipper agreed with you.">
        <Input inputMode="decimal" value={vendorRate} onChange={(e) => setVendorRate(e.target.value)} placeholder="0" required />
      </Field>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] gap-3">
        <Field label={`Client price${unitWord}`}>
          <Input inputMode="decimal" value={clientRate} onChange={(e) => setClientRate(e.target.value)} placeholder="0" required />
        </Field>
        <Field label="Currency">
          <CurrencySelect value={currency} onChange={setCurrency} rates={latest} />
        </Field>
      </div>
      <RateField currency={currency} locked={locked} latest={latest} manual={manualRate} onManualChange={setManualRate} />

      <Field label="Vendor or designer (optional)">
        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">Not specified</option>
          {vendors.length ? (
            <optgroup label="Vendors">
              {vendors.map((v) => (
                <option key={v.id} value={`v:${v.id}`}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {designers.length ? (
            <optgroup label="Designers">
              {designers.map((d) => (
                <option key={d.id} value={`d:${d.id}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </Field>

      {preview ? (
        <dl className="grid grid-cols-3 gap-2 rounded-3xl bg-accent-soft/60 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Vendor total</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(preview.vendorTotal, "INR")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Client total</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(preview.clientTotal, currency)}</dd>
            {currency !== "INR" && preview.clientInr !== null ? <dd className="text-xs text-muted">≈ {formatCurrency(preview.clientInr, "INR")}</dd> : null}
          </div>
          <div>
            <dt className="text-xs text-muted">Your margin</dt>
            <dd className={`font-semibold tabular-nums ${preview.margin !== null && preview.margin < 0 ? "text-risk" : ""}`}>
              {preview.margin === null ? "–" : formatCurrency(preview.margin, "INR")}
            </dd>
            <dd className="text-xs text-muted">{formatPct(preview.marginPct)}</dd>
          </div>
        </dl>
      ) : null}

      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || !valid}>
        {pending ? "Saving…" : line ? "Save line" : "Add line"}
      </Button>
      {line ? (
        <button type="button" onClick={remove} className="min-h-11 w-full text-sm font-medium text-risk hover:underline">
          Delete line
        </button>
      ) : null}
    </form>
  );
}
