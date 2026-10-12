import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAuth } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { Button } from "./ui/button";

export async function SiteHeader() {
  const t = await getTranslations("Header");
  const auth = await getAuth();
  return (
    <header className="bg-navy text-on-dark">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link
          href="/"
          className="flex min-h-11 items-center font-display text-2xl font-bold uppercase tracking-wide"
        >
          {t.rich("brand", {
            accent: (chunks) => (
              <span className="ml-1.5 text-primary">{chunks}</span>
            ),
          })}
        </Link>
        {auth && (
          <nav
            aria-label={t("navigation")}
            className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2 text-on-dark-muted"
          >
            <Button
              variant="ghost"
              className="min-h-11 px-3 py-2 text-sm hover:bg-white/10"
              asChild
            >
              <Link href="/leagues">{t("myLeagues")}</Link>
            </Button>
            <form action={signOut}>
              <Button
                variant="ghost"
                className="min-h-11 px-3 py-2 text-sm hover:bg-white/10"
              >
                {t("signOut")}
              </Button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
