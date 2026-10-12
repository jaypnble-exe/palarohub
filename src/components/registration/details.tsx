import { getTranslations, getFormatter } from "next-intl/server";
import type { loadRegistration } from "@/lib/registration-data";

type Data = Extract<
  Awaited<ReturnType<typeof loadRegistration>>,
  { denied: false }
>;
export async function RegistrationDetails({ data }: { data: Data }) {
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const entries =
    data.registration.status === "rejected"
      ? data.entries
      : data.entries.filter((entry) => entry.active);
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <p>
          {t("seasonDivision", {
            season: data.season.name,
            division: data.division.name,
          })}
        </p>
        <p>
          {t("feeValue", {
            amount: format.number(data.registration.fee_halalas / 100, {
              style: "currency",
              currency: "SAR",
            }),
          })}
        </p>
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold">
          {t(`status.${data.registration.status}`)}
        </span>
        {data.registration.review_comment && (
          <p className="rounded-xl bg-accent p-4 text-sm">
            {data.registration.review_comment}
          </p>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("yourRoster")}
        </h2>
        <ul className="divide-y rounded-2xl border bg-card">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <p className="font-semibold">
                {entry.player_name ??
                  data.catalog.find((player) => player.id === entry.player_id)
                    ?.name ??
                  t("player")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("rosterPlayer", {
                  jersey: entry.jersey_number,
                  rating:
                    entry.rating_snapshot ??
                    data.catalog.find((player) => player.id === entry.player_id)
                      ?.rating ??
                    t("unrated"),
                })}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {data.entries.some((entry) => !entry.active && entry.accepted_at) && (
        <details className="rounded-2xl border bg-card p-5">
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
          <ol className="space-y-3">
            {data.reviews.map((review, index) => (
              <li
                key={`${review.created_at}-${index}`}
                className="space-y-2 rounded-xl border bg-card p-4"
              >
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
                {review.comment && <p className="text-sm">{review.comment}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
