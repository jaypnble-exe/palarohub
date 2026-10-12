import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function RegistrationList({
  slug,
  workspace,
  registrations,
}: {
  slug: string;
  workspace: "admin" | "team";
  registrations: {
    id: string;
    team_name: string;
    status: string;
    created_at: string;
    seasons: { name: string } | null;
    divisions: { name: string } | null;
  }[];
}) {
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  return !registrations.length ? (
    <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
      {t("noRegistrations")}
    </p>
  ) : (
    <ul className="space-y-4">
      {registrations.map((registration) => (
        <li
          key={registration.id}
          className="space-y-3 rounded-2xl border bg-card p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">
              {registration.team_name}
            </h2>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold">
              {t(`status.${registration.status}`)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("seasonDivision", {
              season: registration.seasons?.name ?? "",
              division: registration.divisions?.name ?? "",
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {format.dateTime(new Date(registration.created_at), {
              dateStyle: "medium",
            })}
          </p>
          <Button asChild variant="outline">
            <Link
              href={`/${workspace}/${slug}/registrations/${registration.id}`}
            >
              {t(
                workspace === "admin" && registration.status === "submitted"
                  ? "reviewTeam"
                  : "viewRegistration",
              )}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
