"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-soft">T</span>
        <span className="text-xl font-bold tracking-tight">Threadline</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold ${active ? "bg-surface text-accent shadow-soft" : "text-stone-600 hover:bg-surface/60"}`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="truncate px-4 text-xs text-muted">Signed in as {username}</p>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-full bg-surface/95 px-1.5 shadow-lift backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-accent" : "text-stone-500"}`}
              >
                <span className={`flex h-7 w-11 items-center justify-center rounded-full ${active ? "bg-accent-soft" : ""}`}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
