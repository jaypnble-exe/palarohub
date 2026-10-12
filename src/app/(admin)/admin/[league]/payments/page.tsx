import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonPayments } from "@/lib/payments-data";
import { parsePaymentPolicy } from "@/lib/domain/payments";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { PolicyForm } from "@/components/payments/policy-form";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (error) throw new Error("Unable to load seasons.");
  const season = seasons.find((item) => item.id === query.season) ?? seasons[0];
  const teams = season
    ? (await seasonPayments(supabase, league.id, season.id)).sort(
        (a, b) =>
          b.status.behindByHalalas - a.status.behindByHalalas ||
          a.teamName.localeCompare(b.teamName),
      )
    : [];
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const sar = (halalas: number) =>
    format.number(halalas / 100, { style: "currency", currency: "SAR" });
  const behind = teams.filter((team) => team.status.behind);
  const chip =
    "inline-flex min-h-11 items-center rounded-xl border-2 bg-background px-4 font-semibold aria-[current=true]:border-navy aria-[current=true]:bg-navy aria-[current=true]:text-on-dark";
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}`}>{t("backToLeague")}</Link>
      </Button>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        {season && <p className="text-muted-foreground">{season.name}</p>}
      </div>
      {seasons.length > 1 && (
        <nav aria-label={t("chooseSeason")} className="flex flex-wrap gap-2">
          {seasons.map((item) => (
            <Link
              key={item.id}
              href={`/admin/${slug}/payments?season=${item.id}`}
              aria-current={item.id === season?.id}
              className={chip}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      )}
      {season && (
        <p className="rounded-2xl border bg-card p-4 font-semibold">
          {t("behindCount", { count: behind.length })}
        </p>
      )}
      {!teams.length ? (
        <p className="rounded-2xl border bg-card p-5">{t("noTeams")}</p>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => (
            <li key={team.seasonTeamId}>
              <Link
                href={`/admin/${slug}/payments/${team.seasonTeamId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4 hover:bg-accent"
              >
                <span>
                  <span className="block font-semibold">{team.teamName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {team.divisionName} ·{" "}
                    {t("paidOf", {
                      paid: sar(team.paidHalalas),
                      total: sar(team.quotaHalalas + team.finesHalalas),
                    })}
                  </span>
                </span>
                <span
                  className={
                    team.status.behind
                      ? "rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive"
                      : team.status.paidInFull
                        ? "rounded-full bg-green-700 px-3 py-1 text-sm font-semibold text-white"
                        : "rounded-full bg-accent px-3 py-1 text-sm font-semibold"
                  }
                >
                  {team.status.behind
                    ? t("behindBy", {
                        amount: sar(team.status.behindByHalalas),
                      })
                    : team.status.paidInFull
                      ? t("paidInFull")
                      : t("upToDate")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <PolicyForm slug={slug} initial={parsePaymentPolicy(league.settings)} />
      )}
    </main>
  );
}
