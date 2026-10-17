import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { findUsers } from "@/lib/platform-data";
import { AccessDenied } from "@/components/access-denied";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

/** Look someone up by email or name and see every role they hold. */
export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requireUser("/admin/users");
  if (!(await isPlatformAdmin())) return <AccessDenied />;
  const query = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [t, roles, format] = await Promise.all([
    getTranslations("Platform"),
    getTranslations("Roles"),
    getFormatter(),
  ]);
  const tooShort = query.length > 0 && query.length < 3;
  const users = query.length >= 3 ? await findUsers(supabase, query) : null;
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <PageHeader
        back={{ href: "/admin", label: t("back") }}
        title={t("usersTitle")}
        description={t("usersIntro")}
      />
      <form
        action="/admin/users"
        role="search"
        className="flex flex-wrap items-end gap-3"
      >
        <Field
          id="user-search"
          label={t("searchLabel")}
          error={tooShort ? t("searchTooShort") : undefined}
          className="min-w-0 flex-1"
        >
          <Input
            id="user-search"
            name="q"
            type="search"
            defaultValue={query}
            autoComplete="off"
            aria-invalid={tooShort}
          />
        </Field>
        <Button type="submit" variant="dark">
          <Icon name="search" className="size-5" />
          {t("searchButton")}
        </Button>
      </form>
      {users && users.length === 0 && (
        <Alert tone="info">{t("searchEmpty", { query })}</Alert>
      )}
      {users && users.length > 0 && (
        <ul className="space-y-3">
          {users.map((person) => (
            <li key={person.user_id}>
              <Card className="space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold break-words">
                    {person.display_name || person.email}
                    {person.is_platform_admin && (
                      <Badge tone="dark" className="ml-2">
                        {t("platformAdminBadge")}
                      </Badge>
                    )}
                  </p>
                  {person.display_name && (
                    <p className="text-sm break-all text-muted-foreground">
                      {person.email}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t("userJoined", { date: date(person.created_at) })} ·{" "}
                    {person.last_sign_in_at
                      ? t("lastSignIn", { date: date(person.last_sign_in_at) })
                      : t("neverSignedIn")}
                  </p>
                </div>
                {person.email_confirmed_at ? (
                  <Badge tone="success">{t("emailConfirmed")}</Badge>
                ) : (
                  <Alert tone="warning">
                    <strong>{t("emailNotConfirmed")}</strong>{" "}
                    {t("emailNotConfirmedHelp")}
                  </Alert>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t("rolesTitle")}</p>
                  {person.memberships.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("noRoles")}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {person.memberships.map((membership) => (
                        <li key={`${membership.leagueId}-${membership.role}`}>
                          <Link
                            href={`/admin/leagues/${membership.slug}`}
                            className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold hover:bg-accent"
                          >
                            {membership.league} · {roles(membership.role)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {person.managed_teams.map((team) => (
                    <p
                      key={`${team.league}-${team.team}`}
                      className="text-sm text-muted-foreground"
                    >
                      {t("manages", team)}
                    </p>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {users && users.length === 25 && (
        <p className="text-sm text-muted-foreground">{t("searchLimit")}</p>
      )}
    </main>
  );
}
