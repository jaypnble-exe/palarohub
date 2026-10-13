"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { requestRosterChange } from "@/app/(team)/team/[league]/actions";
import {
  rosterChangeSchema,
  type RosterEntryInput,
  type RegistrationPlayer,
} from "@/lib/validation/registration";
import {
  checkRosterEligibility,
  type EligibilityRules,
} from "@/lib/domain/eligibility";
import { Button } from "@/components/ui/button";
import { RosterEditor } from "./roster-editor";
import { useRegistrationMutation } from "./mutation";
import { EligibilityFeedback, RegistrationFeedback } from "./feedback";
import { Textarea } from "@/components/ui/field";

export function RosterChangeForm({
  slug,
  registrationId,
  initial,
  catalog,
  rules,
}: {
  slug: string;
  registrationId: string;
  initial: RosterEntryInput[];
  catalog: RegistrationPlayer[];
  rules: EligibilityRules;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  const [roster, setRoster] = useState(initial);
  const [reason, setReason] = useState("");
  const players = roster.map((entry) => {
    const player = catalog.find((item) => item.id === entry.playerId);
    return {
      ...(player ?? {
        id: entry.playerId,
        name: t("player"),
        rating: null,
        suspended: false,
        documentsPresent: false,
        onAnotherTeam: false,
      }),
      jerseyNumber: entry.jerseyNumber,
    };
  });
  const issues = checkRosterEligibility(players, rules);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = rosterChangeSchema.safeParse({
          registrationId,
          roster,
          reason,
        });
        if (!parsed.success) {
          mutation.setResult({ error: "invalidForm" });
          return;
        }
        mutation.run(() => requestRosterChange(slug, parsed.data));
      }}
      noValidate
    >
      <p className="text-sm text-muted-foreground">{t("changeHelp")}</p>
      <RosterEditor
        catalog={catalog}
        value={roster}
        onChange={setRoster}
        min={rules.rosterMin}
        limit={rules.rosterMax}
        disabled={mutation.pending}
        issues={issues}
      />
      <EligibilityFeedback
        issues={issues.filter((issue) => !issue.playerId)}
        quiet={issues.some((issue) => issue.playerId)}
      />
      <div className="space-y-2">
        <label htmlFor="roster-change-reason" className="font-semibold">
          {t("changeReason")}
        </label>
        <Textarea
          id="roster-change-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
        />
      </div>
      <Button disabled={mutation.pending || issues.length > 0}>
        {t(mutation.pending ? "saving" : "requestChange")}
      </Button>
      <RegistrationFeedback
        result={mutation.result}
        successKey="changeRequested"
      />
    </form>
  );
}
