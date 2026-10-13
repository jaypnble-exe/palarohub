import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Stepper } from "@/components/ui/stepper";
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
        <Stepper
          label={t("progressLabel")}
          steps={steps.map((step) => t(step))}
          current={status === "approved" ? steps.length : reached - 1}
          tone={status === "returned" ? "primary" : "navy"}
        />
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
