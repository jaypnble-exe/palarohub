"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveRatingScale } from "@/app/(admin)/admin/[league]/seasons/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RatingScaleForm({
  slug,
  labels,
  canManage,
}: {
  slug: string;
  labels: string[];
  canManage: boolean;
}) {
  const t = useTranslations("Seasons");
  const [value, setValue] = useState(labels.join(", "));
  const [feedback, setFeedback] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setFeedback(undefined);
        startTransition(async () => {
          try {
            const result = await saveRatingScale(slug, value.split(","));
            setFeedback("error" in result ? result.error : "scaleSaved");
          } catch {
            setFeedback("saveFailed");
          }
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="rating-labels" className="font-semibold">
          {t("scaleOrder")}
        </label>
        <Input
          id="rating-labels"
          value={value}
          disabled={!canManage || pending}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby="rating-help"
        />
        <p id="rating-help" className="text-sm text-muted-foreground">
          {t("scaleHelp")}
        </p>
      </div>
      <p className="rounded-xl border bg-card p-4 text-sm">
        {t("scaleSnapshot")}
      </p>
      {canManage && (
        <Button disabled={pending}>
          {t(pending ? "saving" : "saveScale")}
        </Button>
      )}
      {feedback && <p role="status">{t(feedback)}</p>}
    </form>
  );
}
