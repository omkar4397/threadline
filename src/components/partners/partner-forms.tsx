"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { insertRow, updateRow } from "@/lib/mutations";
import { errorMessage, int, text } from "@/lib/form";
import { VENDOR_TYPES, VENDOR_TYPE_LABEL, type VendorType } from "@/lib/labels";
import type { Designer, Vendor } from "@/lib/types";
import { RatingInput } from "./rating-input";

function usePartnerSubmit(kind: "vendors" | "designers", existingId: string | undefined, onClose: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(values: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      if (existingId) {
        await updateRow(kind, existingId, values);
        router.refresh();
      } else {
        const id = await insertRow(kind, values as never);
        router.push(`/partners/${kind}/${id}`);
      }
      toast("Saved");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return { submit, error, pending };
}

function LeadAndRating({ lead, rating }: { lead: number | null; rating: number | null }) {
  return (
    <>
      <Field label="Typical lead time (days)" hint="Used instead of the stage default when assigned to a task.">
        <Input name="typical_lead_days" type="number" inputMode="numeric" min={1} max={365} defaultValue={lead ?? ""} />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium">Rating</span>
        <RatingInput name="rating" defaultValue={rating} />
      </div>
    </>
  );
}

function FormShell({ children, error, pending, label, onSubmit }: { children: ReactNode; error: string | null; pending: boolean; label: string; onSubmit: (form: FormData) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      {children}
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}

export function VendorFormSheet({ open, onClose, vendor }: { open: boolean; onClose: () => void; vendor?: Vendor }) {
  const { submit, error, pending } = usePartnerSubmit("vendors", vendor?.id, onClose);
  return (
    <Sheet open={open} onClose={onClose} title={vendor ? "Edit vendor" : "New vendor"}>
      <FormShell
        error={error}
        pending={pending}
        label={vendor ? "Save vendor" : "Add vendor"}
        onSubmit={(form) =>
          submit({
            name: text(form, "name"),
            type: (text(form, "type") ?? "other") as VendorType,
            contact_person: text(form, "contact_person"),
            phone: text(form, "phone"),
            email: text(form, "email"),
            location: text(form, "location"),
            specialty: text(form, "specialty"),
            typical_lead_days: int(form, "typical_lead_days"),
            minimum_order: text(form, "minimum_order"),
            payment_terms: text(form, "payment_terms"),
            rating: int(form, "rating"),
            notes: text(form, "notes"),
          })
        }
      >
        <Field label="Name">
          <Input name="name" defaultValue={vendor?.name} required autoFocus />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue={vendor?.type ?? "fabric_supplier"}>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {VENDOR_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact person">
          <Input name="contact_person" defaultValue={vendor?.contact_person ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={vendor?.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={vendor?.email ?? ""} />
          </Field>
        </div>
        <Field label="Location">
          <Input name="location" defaultValue={vendor?.location ?? ""} />
        </Field>
        <Field label="Specialty">
          <Input name="specialty" defaultValue={vendor?.specialty ?? ""} placeholder="e.g. silk, digital printing" />
        </Field>
        <LeadAndRating lead={vendor?.typical_lead_days ?? null} rating={vendor?.rating ?? null} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum order">
            <Input name="minimum_order" defaultValue={vendor?.minimum_order ?? ""} placeholder="e.g. 50 m" />
          </Field>
          <Field label="Payment terms">
            <Input name="payment_terms" defaultValue={vendor?.payment_terms ?? ""} placeholder="e.g. 50% advance" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" defaultValue={vendor?.notes ?? ""} />
        </Field>
      </FormShell>
    </Sheet>
  );
}

export function DesignerFormSheet({ open, onClose, designer }: { open: boolean; onClose: () => void; designer?: Designer }) {
  const { submit, error, pending } = usePartnerSubmit("designers", designer?.id, onClose);
  return (
    <Sheet open={open} onClose={onClose} title={designer ? "Edit designer" : "New designer"}>
      <FormShell
        error={error}
        pending={pending}
        label={designer ? "Save designer" : "Add designer"}
        onSubmit={(form) =>
          submit({
            name: text(form, "name"),
            contact_person: text(form, "contact_person"),
            phone: text(form, "phone"),
            email: text(form, "email"),
            specialty: text(form, "specialty"),
            typical_lead_days: int(form, "typical_lead_days"),
            rate: text(form, "rate"),
            rating: int(form, "rating"),
            notes: text(form, "notes"),
            portfolio_url: text(form, "portfolio_url"),
          })
        }
      >
        <Field label="Name">
          <Input name="name" defaultValue={designer?.name} required autoFocus />
        </Field>
        <Field label="Contact person">
          <Input name="contact_person" defaultValue={designer?.contact_person ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={designer?.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={designer?.email ?? ""} />
          </Field>
        </div>
        <Field label="Specialty">
          <Input name="specialty" defaultValue={designer?.specialty ?? ""} placeholder="e.g. block prints, bridal" />
        </Field>
        <LeadAndRating lead={designer?.typical_lead_days ?? null} rating={designer?.rating ?? null} />
        <Field label="Rate">
          <Input name="rate" defaultValue={designer?.rate ?? ""} placeholder="e.g. ₹2,000 per design" />
        </Field>
        <Field label="Portfolio link">
          <Input name="portfolio_url" type="url" defaultValue={designer?.portfolio_url ?? ""} placeholder="https://" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" defaultValue={designer?.notes ?? ""} />
        </Field>
      </FormShell>
    </Sheet>
  );
}
