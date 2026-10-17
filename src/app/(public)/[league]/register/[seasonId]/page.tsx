import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth, getSiteUrl } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinRegistrationButton } from "@/components/registration/join-button";
import { ShareButtons } from "@/components/share-buttons";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import { formatSar } from "@/lib/format";

const dayMs = 86_400_000;

/** The registration link a commissioner shares: what to know, then one button. */
export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const [season, settings, divisions, teams] = await Promise.all([
    supabase
      .from("seasons")
      .select("name,start_date,end_date,rating_scale")
      .eq("league_id", league.id)
      .eq("id", seasonId)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("registration_settings")
      .select("is_open,deadline,fee_halalas,require_documents")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .maybeSingle(),
    supabase
      .from("divisions")
      .select("id,name,max_rating,roster_min,roster_max")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .order("name"),
    supabase
      .from("published_season_teams")
      .select("division_id")
      .eq("league_id", league.id)
      .eq("season_id", seasonId),
  ]);
  if (season.error || settings.error || divisions.error || teams.error)
    throw new Error("Unable to load public registration.");
  if (!season.data) notFound();
  const [t, format, auth] = await Promise.all([
    getTranslations("Registration"),
    getFormatter(),
    getAuth(),
  ]);
  const now = new Date().getTime();
  const deadline = settings.data ? new Date(settings.data.deadline) : null;
  const isOpen = Boolean(
    settings.data?.is_open && deadline && deadline.getTime() > now,
  );
  const daysLeft = deadline
    ? Math.max(0, Math.floor((deadline.getTime() - now) / dayMs))
    : 0;
  const path = `/${slug}/register/${seasonId}`;
  const scale = season.data.rating_scale;
  const allowed = (max: string) => {
    const from = scale.indexOf(max);
    return from < 0 ? [max] : scale.slice(from);
  };
  const rosterMin = Math.min(
    ...(divisions.data ?? []).map((d) => d.roster_min),
  );
  const rosterMax = Math.max(
    ...(divisions.data ?? []).map((d) => d.roster_max),
  );
  const approved = (divisionId: string) =>
    (teams.data ?? []).filter((team) => team.division_id === divisionId).length;
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const fee = settings.data?.fee_halalas ?? 0;
  const facts = [
    {
      label: t("publicFactFee"),
      value: fee > 0 ? formatSar(format, fee) : t("publicFeeFree"),
      detail: fee > 0 ? t("publicFactFeeDetail") : undefined,
    },
    {
      label: t("publicFactPlayers"),
      value: divisions.data?.length
        ? t("publicPlayerRange", { min: rosterMin, max: rosterMax })
        : "–",
    },
    {
      label: t("publicFactSeason"),
      value: `${date(season.data.start_date)} – ${date(season.data.end_date)}`,
    },
    {
      label: t("publicFactDivisions"),
      value: String(divisions.data?.length ?? 0),
    },
  ];
  const steps = [1, 2, 3, 4] as const;

  const action = (onDark: boolean) =>
    !isOpen ? null : auth ? (
      <div className="space-y-2">
        <JoinRegistrationButton slug={slug} seasonId={seasonId} />
        {auth.user.email && (
          <p
            className={cn(
              "text-sm",
              onDark
                ? "text-on-dark-muted"
                : "text-center text-muted-foreground",
            )}
          >
            {t("publicSignedInAs", { email: auth.user.email })}
          </p>
        )}
      </div>
    ) : (
      <div className="space-y-2">
        <Button asChild className="w-full">
          <Link href={`/login?next=${encodeURIComponent(path)}`}>
            {t("signInRegister")}
            <Icon name="arrow" className="size-5" />
          </Link>
        </Button>
        <p
          className={cn(
            "text-sm",
            onDark ? "text-on-dark-muted" : "text-center text-muted-foreground",
          )}
        >
          {t("publicSignInHelp")}
        </p>
      </div>
    );

  return (
    <main className="mx-auto max-w-3xl space-y-8 pb-16">
      {/* On phones the banner runs edge to edge, continuing the header. */}
      <section className="-mx-5 space-y-5 bg-navy px-5 pt-6 pb-8 text-on-dark sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-10 sm:py-10">
        <Link
          href={`/${slug}`}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-on-dark-muted hover:bg-white/10 hover:text-on-dark"
        >
          <Icon name="back" className="size-5" />
          {league.name}
        </Link>
        <div className="space-y-3">
          <Badge tone={isOpen ? "primary" : "dark"}>
            {isOpen && (
              <span
                className="size-2 rounded-full bg-white"
                aria-hidden="true"
              />
            )}
            {t(isOpen ? "publicOpenBadge" : "publicClosedBadge")}
          </Badge>
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-wide break-words uppercase sm:text-5xl">
            {season.data.name}
          </h1>
          <p className="max-w-prose text-on-dark-muted">
            {t("publicRegistrationIntro")}
          </p>
        </div>
        {isOpen && deadline && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
            <Icon name="schedule" className="size-6 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">
                {t("publicClosesIn", { days: daysLeft })}
              </p>
              <p className="text-sm text-on-dark-muted">
                {t("publicClosesAt", {
                  date: format.dateTime(deadline, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                })}
              </p>
            </div>
          </div>
        )}
        {isOpen && <div className="sm:max-w-sm">{action(true)}</div>}
      </section>

      {!isOpen && (
        <Alert tone="warning">
          <strong>{t("publicClosedTitle")}</strong> {t("publicClosedBody")}
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className={cn(cardVariants(), "space-y-1")}>
            <dt className="text-sm font-semibold text-muted-foreground">
              {fact.label}
            </dt>
            <dd className="font-display text-xl leading-tight font-semibold sm:text-2xl">
              {fact.value}
            </dd>
            {fact.detail && (
              <dd className="text-sm text-muted-foreground">{fact.detail}</dd>
            )}
          </div>
        ))}
      </dl>

      <Section
        id="divisions"
        title={t("publicDivisionsTitle")}
        description={t("publicDivisionsHelp")}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {(divisions.data ?? []).map((division) => {
            const ratings = allowed(division.max_rating);
            return (
              <li key={division.id} className={cn(cardVariants(), "space-y-3")}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold break-words">
                    {division.name}
                  </h3>
                  <Badge tone="warning">
                    {t("publicMaxRating", { rating: division.max_rating })}
                  </Badge>
                </div>
                <div
                  className="flex flex-wrap gap-1.5"
                  aria-label={t("publicRatingsAllowed", {
                    ratings: ratings.join(", "),
                  })}
                  role="img"
                >
                  {scale.map((rating) => (
                    <span
                      key={rating}
                      className={cn(
                        "grid size-9 place-items-center rounded-lg font-display text-lg font-semibold",
                        ratings.includes(rating)
                          ? "bg-navy text-on-dark"
                          : "bg-accent text-muted-foreground line-through",
                      )}
                    >
                      {rating}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("publicRatingsAllowed", { ratings: ratings.join(", ") })}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="players" className="size-4" />
                    {t("publicRosterSize", {
                      min: division.roster_min,
                      max: division.roster_max,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="teams" className="size-4" />
                    {t("publicTeamsIn", { count: approved(division.id) })}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">{t("publicUnrated")}</p>
      </Section>

      <Section id="steps" title={t("publicStepsTitle")}>
        <ol className={cn(cardVariants(), "space-y-4")}>
          {steps.map((step) => (
            <li key={step} className="flex gap-4">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display text-lg font-bold text-white"
                aria-hidden="true"
              >
                {step}
              </span>
              <span className="space-y-0.5">
                <span className="block font-semibold">
                  {t(`publicStep${step}`)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(`publicStep${step}Help`)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {settings.data?.require_documents && (
          <Alert tone="info">{t("publicDocuments")}</Alert>
        )}
      </Section>

      {isOpen && <div className="sm:mx-auto sm:max-w-sm">{action(false)}</div>}

      <section className={cn(cardVariants(), "space-y-3")}>
        <h2 className="font-display text-xl font-semibold">
          {isOpen ? t("publicShareTitle") : t("publicViewLeague")}
        </h2>
        {isOpen ? (
          <ShareButtons
            url={`${getSiteUrl()}${path}`}
            text={t("publicShareText", {
              season: season.data.name,
              league: league.name,
            })}
          />
        ) : (
          <Button asChild variant="outline">
            <Link href={`/${slug}`}>{league.name}</Link>
          </Button>
        )}
      </section>
    </main>
  );
}
