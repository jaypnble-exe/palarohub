"use client";
import { useState, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  addPlayerRating,
  updatePlayerChecks,
} from "@/app/(team)/team/[league]/actions";
import {
  ratingEntrySchema,
  playerChecksSchema,
  type RatingEntryInput,
  type PlayerChecksInput,
} from "@/lib/validation/registration";
import {
  fromRiyadhDateTimeInput,
  toRiyadhDateTimeInput,
} from "@/lib/domain/riyadh-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";

export function PlayerRatingForm({
  slug,
  playerId,
  labels,
  defaultTime,
}: {
  slug: string;
  playerId: string;
  labels: string[];
  defaultTime: string;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  const [date, setDate] = useState(toRiyadhDateTimeInput(defaultTime));
  const {
    register,
    setValue,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<RatingEntryInput>({
    resolver: zodResolver(ratingEntrySchema),
    defaultValues: {
      playerId,
      rating: labels.at(-1) ?? "",
      effectiveFrom: defaultTime,
      reason: "",
    },
  });
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={handleSubmit((input) =>
        mutation.run(
          () => addPlayerRating(slug, input),
          () => resetField("reason"),
        ),
      )}
      noValidate
    >
      <h2 className="font-display text-2xl font-semibold">
        {t("assignRating")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("ratingHistoryHelp")}</p>
      <div className="space-y-2">
        <label htmlFor="player-rating" className="font-semibold">
          {t("rating")}
        </label>
        <select
          id="player-rating"
          {...register("rating")}
          className="min-h-[52px] w-full rounded-xl border-2 bg-card px-3"
        >
          {labels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="rating-effective" className="font-semibold">
          {t("effectiveFrom")}
        </label>
        <Input
          id="rating-effective"
          type="datetime-local"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setValue(
              "effectiveFrom",
              fromRiyadhDateTimeInput(event.target.value) ?? "",
              { shouldValidate: true },
            );
          }}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="rating-reason" className="font-semibold">
          {t("ratingReason")}
        </label>
        <textarea
          id="rating-reason"
          {...register("reason")}
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border-2 bg-background p-3"
          aria-invalid={!!errors.reason}
        />
      </div>
      {!!Object.keys(errors).length && (
        <p role="alert" className="text-sm text-destructive">
          {t("invalidForm")}
        </p>
      )}
      <Button disabled={mutation.pending}>
        {t(mutation.pending ? "saving" : "saveRating")}
      </Button>
      <RegistrationFeedback result={mutation.result} />
    </form>
  );
}
export function PlayerChecksForm({
  slug,
  initial,
  canSuspend,
}: {
  slug: string;
  initial: PlayerChecksInput;
  canSuspend: boolean;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  const id = useId();
  const { register, handleSubmit, control, setValue } =
    useForm<PlayerChecksInput>({
      resolver: zodResolver(playerChecksSchema),
      defaultValues: initial,
    });
  const suspended = useWatch({ control, name: "suspended" });
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={handleSubmit((input) =>
        mutation.run(() => updatePlayerChecks(slug, input)),
      )}
    >
      <h2 className="font-display text-2xl font-semibold">
        {t("playerChecks")}
      </h2>
      <label
        htmlFor={`${id}-documents`}
        className="flex min-h-11 items-center gap-3"
      >
        <input
          id={`${id}-documents`}
          type="checkbox"
          {...register("documentsPresent")}
          className="size-5 accent-primary"
        />
        {t("documentsVerified")}
      </label>
      <p className="text-sm text-muted-foreground">{t("documentsHelp")}</p>
      <label
        htmlFor={`${id}-suspended`}
        className="flex min-h-11 items-center gap-3"
      >
        <input
          id={`${id}-suspended`}
          type="checkbox"
          checked={suspended}
          disabled={!canSuspend}
          onChange={(event) => {
            if (canSuspend) setValue("suspended", event.target.checked);
          }}
          className="size-5 accent-primary"
        />
        {t("suspended")}
      </label>
      <Button variant="outline" disabled={mutation.pending}>
        {t(mutation.pending ? "saving" : "saveChecks")}
      </Button>
      <RegistrationFeedback result={mutation.result} />
    </form>
  );
}
