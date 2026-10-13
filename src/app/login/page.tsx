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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: requestedNext, error } = await searchParams;
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
  return (
    <main className="mx-auto w-full max-w-md space-y-7 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {errorKey && <Alert tone="danger">{t(errorKey)}</Alert>}
      {configured ? (
        <>
          {seasonId && (
            <Alert tone="info">
              {season
                ? t("registeringFor", { season: season.name })
                : t("registeringTeam")}
            </Alert>
          )}
          <LoginForm next={next} startNew={Boolean(seasonId)} />
          {google && (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {t("or")}
              </p>
              <form action={signInWithGoogle.bind(null, next)}>
                <Button variant="outline" className="w-full">
                  {t("google")}
                </Button>
              </form>
            </>
          )}
        </>
      ) : (
        <p role="status" className="rounded-xl border p-4">
          {t("unavailable")}
        </p>
      )}
    </main>
  );
}
