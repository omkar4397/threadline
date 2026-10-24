"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, USERNAME_PATTERN, usernameToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { errorMessage } from "@/lib/form";

export function LoginForm({ mode }: { mode: "login" | "setup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const username = normalizeUsername(String(form.get("username") ?? ""));
    const password = String(form.get("password") ?? "");

    if (mode === "setup") {
      if (!USERNAME_PATTERN.test(username)) {
        setError("Username must be 3–32 characters: letters, numbers, dot, dash or underscore.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== form.get("confirm")) {
        setError("Passwords don’t match.");
        return;
      }
    }

    setPending(true);
    try {
      const supabase = createClient();
      if (mode === "setup") {
        const { error: setupError } = await supabase.rpc("create_owner_account", {
          p_username: username,
          p_password: password,
        });
        if (setupError) throw setupError;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (signInError) {
        throw new Error(signInError.message === "Invalid login credentials" ? "Wrong username or password." : signInError.message);
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <Field label="Username">
        <Input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      </Field>
      <Field label="Password" hint={mode === "setup" ? "At least 8 characters." : undefined}>
        <Input name="password" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} required />
      </Field>
      {mode === "setup" ? (
        <Field label="Confirm password">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      ) : null}
      <FormError message={error} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "setup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
