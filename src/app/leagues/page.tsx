import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, isPlatformAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/database.types";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function MyLeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("league_members")
    .select("role,leagues(id,name,slug,sport)")
    .eq("user_id", user.id);
  if (error) throw new Error("Unable to load memberships.");
  const t = await getTranslations("MyLeagues");
  const roles = await getTranslations("Roles");
  const admin = await isPlatformAdmin();
  type Role = Database["public"]["Enums"]["league_role"];
  type LeagueCard = { name: string; slug: string; roles: Role[] };
  const leagues = new Map<string, LeagueCard>();
  for (const membership of data ?? []) {
    const league = membership.leagues;
    if (!league) continue;
    const item: LeagueCard = leagues.get(league.id) ?? {
      name: league.name,
      slug: league.slug,
      roles: [],
    };
    item.roles.push(membership.role);
    leagues.set(league.id, item);
  }
  const params = await searchParams;
  return (
    <main className="space-y-6 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      {params.error === "signOutFailed" && (
        <p role="alert" className="text-destructive">
          {t("signOutFailed")}
        </p>
      )}
      {admin && (
        <Button asChild>
          <Link href="/admin">{t("create")}</Link>
        </Button>
      )}
      {!leagues.size ? (
        <div className={cardVariants({ padding: "lg" })}>
          <p className="font-medium">{t("empty")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("emptyHelp")}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {[...leagues.entries()].map(([id, league]) => (
            <li key={id} className={cn(cardVariants(), "space-y-4")}>
              <div>
                <h2 className="text-xl font-semibold">{league.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {league.roles.map((role) => roles(role)).join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link
                    href={
                      league.roles.some(
                        (role) =>
                          role === "commissioner" || role === "league_staff",
                      )
                        ? `/admin/${league.slug}`
                        : `/team/${league.slug}`
                    }
                  >
                    {t("open")}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/${league.slug}`}>{t("publicPage")}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
