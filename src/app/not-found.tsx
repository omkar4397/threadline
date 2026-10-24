import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted">This page doesn’t exist or was deleted.</p>
      <Link href="/" className={buttonClass("primary")}>
        Back to timeline
      </Link>
    </main>
  );
}
