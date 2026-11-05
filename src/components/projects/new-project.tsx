"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { insertRow } from "@/lib/mutations";
import { errorMessage } from "@/lib/form";

export function NewProjectSheet({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="New project">
      {open ? <NewProjectForm clientId={clientId} /> : null}
    </Sheet>
  );
}

function NewProjectForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const id = await insertRow("projects", { client_id: clientId, name: name.trim(), delivery_date: delivery, notes: notes.trim() || null });
      toast("Project created. Add its tasks next.");
      router.push(`/projects/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Project name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Abaya collection 2027" />
      </Field>
      <Field label="Delivery date">
        <Input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} required />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="text-sm text-muted">You’ll add tasks and milestones on the project page, whenever you know about them.</p>
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending || !name.trim() || !delivery}>
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
