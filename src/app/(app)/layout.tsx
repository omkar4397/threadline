import { createClient } from "@/lib/supabase/server";
import { BottomNav, Sidebar } from "@/components/nav/app-nav";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.user_metadata as { username?: string } | undefined;
  const username = meta?.username ?? (data?.claims?.email as string | undefined)?.split("@")[0] ?? "";

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex min-h-dvh">
          <Sidebar username={username} />
          <main className="min-w-0 flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28 md:px-8 md:pt-8 md:pb-10">{children}</main>
        </div>
        <BottomNav />
      </ConfirmProvider>
    </ToastProvider>
  );
}
