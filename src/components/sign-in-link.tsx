"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The header's sign-in button; hidden on the sign-in page itself. */
export function SignInLink({ label }: { label: string }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return null;
  return (
    <Link
      href="/login"
      className="inline-flex min-h-11 items-center rounded-xl border-2 border-white/30 px-4 text-sm font-bold transition-colors hover:bg-white/10"
    >
      {label}
    </Link>
  );
}
