"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { insertRow, updateRow } from "@/lib/mutations";
import { errorMessage, text } from "@/lib/form";
import type { Client } from "@/lib/types";

export function ClientFormSheet({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = {
      name: text(form, "name") ?? "",
      contact_person: text(form, "contact_person"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      address: text(form, "address"),
      notes: text(form, "notes"),
    };
    setPending(true);
    setError(null);
    try {
      if (client) {
        await updateRow("clients", client.id, values);
        router.refresh();
      } else {
        const id = await insertRow("clients", values);
        router.push(`/clients/${id}`);
      }
      toast(client ? "Client saved" : "Client added");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={client ? "Edit client" : "New client"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name">
          <Input name="name" defaultValue={client?.name} required autoFocus />
        </Field>
        <Field label="Contact person">
          <Input name="contact_person" defaultValue={client?.contact_person ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={client?.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={client?.email ?? ""} />
          </Field>
        </div>
        <Field label="Address">
          <Textarea name="address" rows={2} defaultValue={client?.address ?? ""} />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" defaultValue={client?.notes ?? ""} />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Saving…" : client ? "Save client" : "Add client"}
        </Button>
      </form>
    </Sheet>
  );
}
