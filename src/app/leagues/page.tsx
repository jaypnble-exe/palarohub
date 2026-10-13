import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, isPlatformAdmin } from "@/lib/auth";
import { groupMemberships } from "@/lib/league-list";
import { displayNameOf } from "@/lib/user-name";
import { LeagueCard } from "@/components/leagues/league-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";

/** Where people land after signing in: every league they belong to. */
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
  const admin = await isPlatformAdmin();
  const leagues = groupMemberships(data ?? []);
  const params = await searchParams;
  const name = displayNameOf(user).split(/\s+/)[0];
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <PageHeader
        eyebrow={name ? t("greeting", { name }) : undefined}
        title={t("title")}
        description={t(leagues.length ? "intro" : "introEmpty")}
      />
      {params.error === "signOutFailed" && (
        <Alert tone="danger">{t("signOutFailed")}</Alert>
      )}
      {!leagues.length ? (
        <EmptyState
          icon="leagues"
          title={t("empty")}
          description={t("emptyHelp")}
        />
      ) : (
        <ul className="space-y-4">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </ul>
      )}
      {admin && (
        <Button asChild variant="outline" className="w-full">
          <Link href="/admin">
            <Icon name="add" className="size-5" />
            {t("create")}
          </Link>
        </Button>
      )}
    </main>
  );
}
