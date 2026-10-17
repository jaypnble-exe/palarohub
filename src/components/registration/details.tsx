import { getTranslations, getFormatter } from "next-intl/server";
import type { loadRegistration } from "@/lib/registration-data";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatSar } from "@/lib/format";
import { RegistrationMediaPreview } from "./team-media";

type Data = Extract<
  Awaited<ReturnType<typeof loadRegistration>>,
  { denied: false }
>;
export async function RegistrationDetails({
  data,
  showStatus = true,
  showRoster = true,
  showArtwork = true,
  showSummary = true,
}: {
  data: Data;
  /** Off where a status banner already explains the registration. */
  showStatus?: boolean;
  /** Off while the roster is being edited; the editor already shows it. */
  showRoster?: boolean;
  showArtwork?: boolean;
  /** Off where a banner above already shows the season, division and fee. */
  showSummary?: boolean;
}) {
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const entries = (
    data.registration.status === "rejected"
      ? data.entries
      : data.entries.filter((entry) => entry.active)
  ).toSorted((a, b) => a.jersey_number - b.jersey_number);
  const catalogPlayer = (playerId: string) =>
    data.catalog.find((player) => player.id === playerId);
  return (
    <div className="space-y-6">
      {showArtwork && <RegistrationMediaPreview assets={data.media} />}
      {showRoster && (
        <>
          {showSummary && (
            <section className={cn(cardVariants(), "space-y-3")}>
              <p>
                {t("seasonDivision", {
                  season: data.season.name,
                  division: data.division.name,
                })}
              </p>
              <p>
                {t("feeValue", {
                  amount: formatSar(format, data.registration.fee_halalas),
                })}
              </p>
              {showStatus && (
                <Badge>{t(`status.${data.registration.status}`)}</Badge>
              )}
              {showStatus && data.registration.review_comment && (
                <p className="rounded-xl bg-accent p-4 text-sm">
                  {data.registration.review_comment}
                </p>
              )}
            </section>
          )}
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold">
                {t("yourRoster")}
              </h2>
              <p className="text-sm font-semibold text-muted-foreground">
                {t("rosterCount", { count: entries.length })} ·{" "}
                {t("rosterAllowed", {
                  min: data.division.roster_min,
                  max: data.division.roster_max,
                })}
              </p>
            </div>
            <ul
              className={cn(
                cardVariants({ padding: "none" }),
                "divide-y sm:grid sm:grid-cols-2 sm:divide-y-0",
              )}
            >
              {entries.map((entry) => {
                const rating =
                  entry.rating_snapshot ??
                  catalogPlayer(entry.player_id)?.rating ??
                  null;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 sm:border-b sm:odd:border-r"
                  >
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy font-display text-xl font-semibold text-on-dark tabular-nums"
                      aria-label={t("jerseyLabel", {
                        number: entry.jersey_number,
                      })}
                    >
                      {entry.jersey_number}
                    </span>
                    <span className="min-w-0 flex-1 font-semibold break-words">
                      {entry.player_name ??
                        catalogPlayer(entry.player_id)?.name ??
                        t("player")}
                    </span>
                    <Badge tone={rating ? "neutral" : "warning"}>
                      {rating
                        ? t("ratingBadge", { rating })
                        : t("unratedBadge")}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
      {data.entries.some((entry) => !entry.active && entry.accepted_at) && (
        <details className={cardVariants()}>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t("previousRosters")}
          </summary>
          <ul className="space-y-3">
            {data.entries
              .filter((entry) => !entry.active && entry.accepted_at)
              .map((entry) => (
                <li key={entry.id} className="border-t pt-3 text-sm">
                  <p>{entry.player_name}</p>
                  <p>
                    {t("rosterPlayer", {
                      jersey: entry.jersey_number,
                      rating: entry.rating_snapshot ?? t("unrated"),
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {format.dateTime(new Date(entry.accepted_at!), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
          </ul>
        </details>
      )}
      {data.reviews.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {t("reviewHistory")}
          </h2>
          <ol className="relative space-y-4 border-l-2 border-border pl-6">
            {data.reviews.map((review, index) => (
              <li key={`${review.created_at}-${index}`} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[1.95rem] size-3.5 rounded-full border-2 border-card bg-primary"
                />
                <p className="font-semibold">{t(`history.${review.action}`)}</p>
                <p className="text-sm text-muted-foreground">
                  {t("reviewBy", {
                    name: review.profiles?.display_name || t("leagueOfficial"),
                    date: format.dateTime(new Date(review.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
                {review.comment && (
                  <p className="mt-1 rounded-xl bg-accent p-3 text-sm">
                    {review.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
