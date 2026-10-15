"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { formatClockTime, parseClockTime } from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecordEvent } from "./board";

export function ClockEditor({
  remainingMs,
  maxMs,
  disabled,
  record,
  onClose,
}: {
  remainingMs: number;
  maxMs: number;
  disabled: boolean;
  record: RecordEvent;
  onClose: () => void;
}) {
  const t = useTranslations("Scorer");
  const id = useId();
  const [time, setTime] = useState(() => formatClockTime(remainingMs));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        noValidate
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-background p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          const next = parseClockTime(time);
          if (next === null || next > maxMs) {
            setError(
              t("clockTimeInvalid", { maximum: formatClockTime(maxMs) }),
            );
            return;
          }
          if (!reason.trim()) {
            setError(t("clockReasonRequired"));
            return;
          }
          if (
            record("clock_adjust", { remainingMs: next, reason: reason.trim() })
          )
            onClose();
        }}
      >
        <h2 id={`${id}-title`} className="font-display text-2xl font-semibold">
          {t("editClock")}
        </h2>
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {t("editClockHelp")}
        </p>
        <div className="space-y-2">
          <label htmlFor={`${id}-time`} className="font-semibold">
            {t("correctedTime")}
          </label>
          <Input
            id={`${id}-time`}
            value={time}
            autoFocus
            placeholder="02:35.4"
            maxLength={7}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setTime(event.target.value);
              setError(undefined);
            }}
          />
          <p className="text-sm text-muted-foreground">
            {t("clockTimeFormat")}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-reason`} className="font-semibold">
            {t("clockCorrectionReason")}
          </label>
          <Input
            id={`${id}-reason`}
            value={reason}
            maxLength={300}
            disabled={disabled}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancelClockEdit")}
          </Button>
          <Button type="submit" disabled={disabled}>
            {t("applyClockCorrection")}
          </Button>
        </div>
      </form>
    </div>
  );
}
