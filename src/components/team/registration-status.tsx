import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ManagerRegistration } from "@/lib/team-data";

const tone = {
  draft: "info",
  submitted: "info",
  returned: "warning",
  approved: "success",
  rejected: "danger",
} as const;

/** How far along Draft → Sent → Approved a registration is (1–3). */
function reachedStep(status: ManagerRegistration["status"]) {
  if (status === "approved") return 3;
  return status === "draft" || status === "returned" ? 1 : 2;
}

/**
 * Where a team's registration stands, in plain words, and the league's
 * comment when it was sent back or rejected.
 */
export async function RegistrationStatus({
  status,
  seasonName,
  comment,
}: {
  status: ManagerRegistration["status"];
  seasonName: string;
  comment: string;
}) {
  const t = await getTranslations("TeamHome");
  const reached = reachedStep(status);
  const steps = ["stepDraft", "stepSent", "stepApproved"] as const;
  return (
    <div className="space-y-4">
      {status !== "rejected" && (
        <ol className="flex items-center gap-2" aria-label={t("progressLabel")}>
          {steps.map((step, index) => {
            const done =
              index + 1 < reached || (status === "approved" && index === 2);
            const current = index + 1 === reached && status !== "approved";
            return (
              <li
                key={step}
                aria-current={current ? "step" : undefined}
                className="flex flex-1 items-center gap-2"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                    done
                      ? "bg-success text-white"
                      : current
                        ? status === "returned"
                          ? "bg-primary text-white"
                          : "bg-navy text-on-dark"
                        : "bg-accent text-muted-foreground",
                  )}
                >
                  {done ? <Icon name="check" className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    !done && !current && "text-muted-foreground",
                  )}
                >
                  {t(step)}
                </span>
                {index < steps.length - 1 && (
                  <span
                    className="h-0.5 flex-1 rounded bg-border"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
      <Alert tone={tone[status]} title={t(`statusTitle.${status}`)}>
        <p>{t(`statusBody.${status}`, { season: seasonName })}</p>
        {comment && (status === "returned" || status === "rejected") && (
          <p className="mt-2 font-semibold">“{comment}”</p>
        )}
      </Alert>
    </div>
  );
}
