"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";

/** The signed-in person's initials; tap for their account options. */
export function AccountMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations("Header");
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close on a tap outside, or with Escape.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const item =
    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold transition-colors hover:bg-accent";
  const links: { href: string; icon: IconName; label: string }[] = [
    { href: "/leagues", icon: "leagues", label: t("switchLeague") },
    { href: "/leagues/password", icon: "lock", label: t("changePassword") },
  ];
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("accountMenu", { name })}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-white/10 aria-expanded:bg-white/10"
      >
        <Avatar
          name={name}
          className="size-9 bg-primary text-base text-white"
        />
        <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">
          {name}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4 text-on-dark-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card p-2 text-foreground shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 pt-2 pb-3">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <ul className="space-y-1 pt-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={item}
                  onClick={() => setOpen(false)}
                >
                  <Icon
                    name={link.icon}
                    className="size-5 text-muted-foreground"
                  />
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <form action={signOut}>
                <button type="submit" className={`${item} text-destructive`}>
                  <Icon name="signOut" className="size-5" />
                  {t("signOut")}
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
