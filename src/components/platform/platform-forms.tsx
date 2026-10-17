"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  addLeagueMember,
  removeLeagueMember,
  replaceCommissioner,
  setLeaguePaused,
  type PlatformActionResult,
} from "@/app/(admin)/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Role = "commissioner" | "league_staff" | "team_manager";

function usePlatformAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PlatformActionResult>();
  function run(
    action: () => Promise<PlatformActionResult>,
    after?: () => void,
  ) {
    setResult(undefined);
    start(async () => {
      try {
        const next = await action();
        setResult(next);
        if (next.success) {
          after?.();
          router.refresh();
        }
      } catch {
        setResult({ error: "saveFailed" });
      }
    });
  }
  return { pending, result, setResult, run };
}

function Feedback({ result }: { result?: PlatformActionResult }) {
  const t = useTranslations("Platform");
  if (!result) return null;
  return (
    <Alert tone={result.error ? "danger" : "success"}>
      {result.error ? t(`error.${result.error}`) : t("saved")}
    </Alert>
  );
}

/** Adds staff, adds a commissioner, or hands the league to a new commissioner. */
export function MemberEmailForm({
  leagueId,
  leagueName,
  mode,
}: {
  leagueId: string;
  leagueName: string;
  mode: "staff" | "commissioner" | "replace";
}) {
  const t = useTranslations("Platform");
  const action = usePlatformAction();
  const [email, setEmail] = useState("");
  const id = `member-email-${mode}`;
  const label = mode === "staff" ? t("staffEmail") : t("newCommissionerEmail");
  const button =
    mode === "staff"
      ? t("addStaff")
      : mode === "commissioner"
        ? t("addCommissioner")
        : t("changeCommissioner");
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = email.trim();
        if (!value.includes("@"))
          return action.setResult({ error: "invalidEmail" });
        if (
          mode === "replace" &&
          !window.confirm(
            t("confirmChange", { email: value, league: leagueName }),
          )
        )
          return;
        action.run(
          () =>
            mode === "replace"
              ? replaceCommissioner({ leagueId, email: value })
              : addLeagueMember({
                  leagueId,
                  email: value,
                  role: mode === "staff" ? "league_staff" : "commissioner",
                }),
          () => setEmail(""),
        );
      }}
    >
      <Field
        id={id}
        label={label}
        help={mode === "replace" ? t("changeCommissionerHelp") : undefined}
      >
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button
        variant={mode === "replace" ? "dark" : "outline"}
        disabled={action.pending}
        className="w-full sm:w-auto"
      >
        {action.pending ? t("saving") : button}
      </Button>
      <Feedback result={action.result} />
    </form>
  );
}

/** Takes one role away from one person, after confirming. */
export function RemoveAccessButton({
  leagueId,
  leagueName,
  userId,
  name,
  role,
  roleLabel,
}: {
  leagueId: string;
  leagueName: string;
  userId: string;
  name: string;
  role: Role;
  roleLabel: string;
}) {
  const t = useTranslations("Platform");
  const action = usePlatformAction();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        disabled={action.pending}
        aria-label={`${t("removeAccess")}: ${name}`}
        onClick={() => {
          if (
            window.confirm(
              t("confirmRemove", { name, role: roleLabel, league: leagueName }),
            )
          )
            action.run(() => removeLeagueMember({ leagueId, userId, role }));
        }}
      >
        {action.pending ? t("saving") : t("removeAccess")}
      </Button>
      {action.result?.error && <Feedback result={action.result} />}
    </div>
  );
}

/** Pauses a league with a reason, or resumes a paused one. */
export function PauseLeagueForm({
  leagueId,
  leagueName,
  paused,
}: {
  leagueId: string;
  leagueName: string;
  paused: boolean;
}) {
  const t = useTranslations("Platform");
  const action = usePlatformAction();
  const [reason, setReason] = useState("");
  if (paused)
    return (
      <div className="space-y-3">
        <Button
          type="button"
          variant="dark"
          disabled={action.pending}
          className="w-full sm:w-auto"
          onClick={() => {
            if (window.confirm(t("confirmResume", { league: leagueName })))
              action.run(() => setLeaguePaused({ leagueId, paused: false }));
          }}
        >
          {action.pending ? t("saving") : t("resumeButton")}
        </Button>
        <Feedback result={action.result} />
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason.trim())
          return action.setResult({ error: "reasonRequired" });
        if (window.confirm(t("confirmPause", { league: leagueName })))
          action.run(
            () => setLeaguePaused({ leagueId, paused: true, reason }),
            () => setReason(""),
          );
      }}
    >
      <Field
        id="pause-reason"
        label={t("pauseReason")}
        help={t("pauseReasonHelp")}
      >
        <Textarea
          id="pause-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Button
        variant="outline"
        disabled={action.pending}
        className="w-full border-destructive text-destructive sm:w-auto"
      >
        {action.pending ? t("saving") : t("pauseButton")}
      </Button>
      <Feedback result={action.result} />
    </form>
  );
}
