"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/form";

export function AccountSettings({ username }: { username: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password") ?? "");
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== form.get("confirm")) return setError("Passwords don’t match.");
    setPending(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      formEl.reset();
      toast("Password changed");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-medium">{username}</p>
        </div>
        <Button onClick={signOut}>Sign out</Button>
      </Card>
      <Card className="px-4 py-4">
        <form onSubmit={changePassword} className="space-y-4">
          <p className="font-medium">Change password</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password">
              <Input name="password" type="password" autoComplete="new-password" required />
            </Field>
            <Field label="Confirm new password">
              <Input name="confirm" type="password" autoComplete="new-password" required />
            </Field>
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
