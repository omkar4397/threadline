import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { LogoMark, Wordmark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: ownerExists, error } = await supabase.rpc("owner_exists");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark size={88} className="mx-auto mb-2" />
          <h1 className="text-4xl">
            <Wordmark />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {ownerExists === false ? "Create your account to get started" : "Sign in to your planner"}
          </p>
        </div>
        {error ? (
          <p className="rounded-2xl bg-risk-soft px-3 py-2 text-sm text-risk">Can’t reach the database right now. Please try again shortly.</p>
        ) : (
          <LoginForm mode={ownerExists === false ? "setup" : "login"} />
        )}
      </div>
    </main>
  );
}
