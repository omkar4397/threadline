import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: ownerExists, error } = await supabase.rpc("owner_exists");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-white">T</div>
          <h1 className="text-2xl font-semibold tracking-tight">Threadline</h1>
          <p className="mt-1 text-sm text-muted">
            {ownerExists === false ? "Create your account to get started" : "Sign in to your planner"}
          </p>
        </div>
        {error ? (
          <p className="rounded-lg bg-risk-soft px-3 py-2 text-sm text-risk">Can’t reach the database right now. Please try again shortly.</p>
        ) : (
          <LoginForm mode={ownerExists === false ? "setup" : "login"} />
        )}
      </div>
    </main>
  );
}
