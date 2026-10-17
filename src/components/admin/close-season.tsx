"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { closeSeason } from "@/app/(admin)/admin/[league]/seasons/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Ends a published season once every game has a result. Closing keeps the
 * final standings for good and stops further results and registrations.
 */
export function CloseSeason({
  slug,
  seasonId,
  seasonName,
  openGames,
}: {
  slug: string;
  seasonId: string;
  seasonName: string;
  /** Games still without a result (not approved, forfeited or cancelled). */
  openGames: number;
}) {
  const t = useTranslations("Seasons");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <section className="space-y-3 rounded-2xl border-2 border-dashed border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("closeTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("closeHelp")}</p>
      </div>
      {openGames > 0 ? (
        <Alert tone="warning">
          {t("closeOpenGames", { count: openGames })}{" "}
          <Link
            href={`/admin/${slug}/schedule`}
            className="font-bold underline"
          >
            {t("closeOpenGamesLink")}
          </Link>
        </Alert>
      ) : (
        <Button
          type="button"
          variant="dark"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t("closeConfirm", { season: seasonName })))
              return;
            setError(undefined);
            start(async () => {
              const result = await closeSeason(slug, seasonId);
              if ("error" in result) setError(result.error);
              else router.refresh();
            });
          }}
        >
          {t(pending ? "saving" : "closeButton")}
        </Button>
      )}
      {error && <Alert tone="danger">{t(`closeError.${error}`)}</Alert>}
    </section>
  );
}
