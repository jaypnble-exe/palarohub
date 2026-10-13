import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { registrationSeason, safeNextPath } from "@/lib/validation/auth";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/app/auth/actions";
import { Alert } from "@/components/ui/alert";
import { isGoogleEnabled } from "@/lib/auth-settings";
import { createClient } from "@/lib/supabase/server";
import { AccessGuide } from "@/components/access-guide";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; new?: string }>;
}) {
  const { next: requestedNext, error, new: startNew } = await searchParams;
  const next = safeNextPath(requestedNext);
  if (await getAuth()) redirect(next);
  const t = await getTranslations("Login");
  const configured = hasSupabaseConfig();
  const google = configured && (await isGoogleEnabled());
  // New team managers arrive from a registration link: start them on "I'm new".
  const seasonId = configured ? registrationSeason(next) : undefined;
  const season = seasonId
    ? (
        await (
          await createClient()
        )
          .from("seasons")
          .select("name")
          .eq("id", seasonId)
          .maybeSingle()
      ).data
    : null;
  const errorKey = ["unavailable", "googleFailed", "callbackFailed"].includes(
    error ?? "",
  )
    ? error
    : undefined;
  const benefits = ["benefitOne", "benefitTwo", "benefitThree"] as const;
  return (
    <main className="grid gap-8 py-8 md:grid-cols-[1fr_1.15fr] md:items-start md:py-12">
      <div className="space-y-5">
        {errorKey && <Alert tone="danger">{t(errorKey)}</Alert>}
        {seasonId && configured && (
          <Alert tone="info">
            {season
              ? t("registeringFor", { season: season.name })
              : t("registeringTeam")}
          </Alert>
        )}
        <div className={cn(cardVariants({ padding: "lg" }), "space-y-5")}>
          {configured ? (
            <>
              <LoginForm
                next={next}
                startNew={Boolean(seasonId) || startNew === "1"}
              />
              {google && (
                <>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {t("or")}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <form action={signInWithGoogle.bind(null, next)}>
                    <Button variant="outline" className="w-full">
                      {t("google")}
                    </Button>
                  </form>
                </>
              )}
            </>
          ) : (
            <Alert tone="warning">{t("unavailable")}</Alert>
          )}
        </div>
      </div>
      {/* Beside the form on wide screens; under it on phones. */}
      <aside className="space-y-5 md:order-first">
        <div className="hidden space-y-5 rounded-3xl bg-navy p-8 text-on-dark md:block">
          <p className="font-display text-3xl leading-tight font-bold tracking-wide uppercase">
            {t.rich("welcome", {
              accent: (chunks) => (
                <span className="text-primary">{chunks}</span>
              ),
            })}
          </p>
          <ul className="space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <Icon name="check" className="size-4" />
                </span>
                <span className="text-on-dark-muted">{t(benefit)}</span>
              </li>
            ))}
          </ul>
        </div>
        {!seasonId && <AccessGuide />}
      </aside>
    </main>
  );
}
