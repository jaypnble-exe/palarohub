import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const features: { key: string; icon: IconName }[] = [
  { key: "register", icon: "teams" },
  { key: "score", icon: "games" },
  { key: "standings", icon: "standings" },
  { key: "schedule", icon: "schedule" },
  { key: "payments", icon: "payments" },
  { key: "share", icon: "share" },
];
const steps = ["setUp", "invite", "play"] as const;
const audiences: { key: string; icon: IconName }[] = [
  { key: "commissioners", icon: "workspace" },
  { key: "managers", icon: "teams" },
  { key: "scorers", icon: "pin" },
  { key: "fans", icon: "public" },
];

/** What PALAROS is, for someone who has just been sent the link. */
export default async function Home() {
  const t = await getTranslations("Home");
  const signedIn = Boolean(await getAuth());
  const primary = signedIn
    ? { href: "/leagues", label: t("openLeagues") }
    : { href: "/login?new=1", label: t("getStarted") };
  return (
    <main className="space-y-14 pb-16">
      {/* On phones the hero runs edge to edge, continuing the header. */}
      <section className="-mx-5 overflow-hidden bg-navy px-5 pt-8 pb-10 text-on-dark sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-10 sm:py-12">
        <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-on-dark-muted">
              <span
                className="size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t("eyebrow")}
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-wide uppercase sm:text-5xl">
              {t.rich("headline", {
                accent: (chunks) => (
                  <span className="text-primary">{chunks}</span>
                ),
              })}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-on-dark-muted">
              {t("tagline")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={primary.href}>
                  {primary.label}
                  <Icon name="arrow" className="size-5" />
                </Link>
              </Button>
              {!signedIn && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/40 bg-transparent text-on-dark hover:bg-white/10"
                >
                  <Link href="/login">{t("signIn")}</Link>
                </Button>
              )}
            </div>
          </div>
          <Scoreboard
            label={t("sampleLabel")}
            live={t("live")}
            period={t("samplePeriod")}
            home={t("sampleHome")}
            away={t("sampleAway")}
            bonus={t("sampleBonus")}
            foul={t("sampleFoul")}
          />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="features-title">
        <div className="space-y-2">
          <h2
            id="features-title"
            className="font-display text-3xl font-semibold tracking-wide uppercase"
          >
            {t("featuresTitle")}
          </h2>
          <p className="max-w-prose text-muted-foreground">
            {t("featuresIntro")}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.key} className={cn(cardVariants(), "space-y-3")}>
              <span className="grid size-11 place-items-center rounded-xl bg-orange-soft text-orange-dark">
                <Icon name={feature.icon} />
              </span>
              <h3 className="text-lg font-semibold">
                {t(`features.${feature.key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`features.${feature.key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6" aria-labelledby="steps-title">
        <h2
          id="steps-title"
          className="font-display text-3xl font-semibold tracking-wide uppercase"
        >
          {t("stepsTitle")}
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className={cn(cardVariants(), "flex gap-4")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy font-display text-lg font-bold text-on-dark">
                {index + 1}
              </span>
              <span className="space-y-1">
                <span className="block font-semibold">
                  {t(`steps.${step}.title`)}
                </span>
                <span className="block text-sm leading-relaxed text-muted-foreground">
                  {t(`steps.${step}.body`)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6" aria-labelledby="audience-title">
        <h2
          id="audience-title"
          className="font-display text-3xl font-semibold tracking-wide uppercase"
        >
          {t("audienceTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {audiences.map((audience) => (
            <li
              key={audience.key}
              className={cn(cardVariants(), "flex items-start gap-4")}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent">
                <Icon name={audience.icon} />
              </span>
              <span className="space-y-1">
                <span className="block font-semibold">
                  {t(`audience.${audience.key}.title`)}
                </span>
                <span className="block text-sm leading-relaxed text-muted-foreground">
                  {t(`audience.${audience.key}.body`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-5 rounded-3xl bg-primary px-6 py-10 text-center text-white sm:px-10">
        <h2 className="font-display text-3xl font-bold tracking-wide uppercase">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto max-w-md text-white/90">{t("ctaBody")}</p>
        <Button asChild variant="dark">
          <Link href={primary.href}>
            {primary.label}
            <Icon name="arrow" className="size-5" />
          </Link>
        </Button>
      </section>

      <footer className="flex flex-col gap-1 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span className="font-display font-semibold tracking-wide text-foreground uppercase">
          {t("name")}
        </span>
        <span>{t("footer")}</span>
      </footer>
    </main>
  );
}

/** A sample of the live score the app keeps: what a game looks like mid-play. */
function Scoreboard({
  label,
  live,
  period,
  home,
  away,
  bonus,
  foul,
}: Record<
  "label" | "live" | "period" | "home" | "away" | "bonus" | "foul",
  string
>) {
  return (
    <figure
      aria-label={label}
      className="rounded-2xl border border-white/15 bg-navy-secondary p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-white">
          <span
            className="size-2 animate-pulse rounded-full bg-white motion-reduce:animate-none"
            aria-hidden="true"
          />
          {live}
        </span>
        <span className="font-display text-lg tracking-wide text-on-dark-muted">
          {period}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3">
        <dt className="truncate text-lg font-semibold">{home}</dt>
        <dd className="font-display text-5xl leading-none font-bold tabular-nums">
          58
        </dd>
        <dt className="truncate text-lg font-semibold text-on-dark-muted">
          {away}
        </dt>
        <dd className="font-display text-5xl leading-none font-bold text-on-dark-muted tabular-nums">
          54
        </dd>
      </dl>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-4 text-sm">
        <span className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold">
          {bonus}
        </span>
        <span className="rounded-lg bg-orange-soft px-2.5 py-1 font-semibold text-orange-dark">
          {foul}
        </span>
      </div>
    </figure>
  );
}
