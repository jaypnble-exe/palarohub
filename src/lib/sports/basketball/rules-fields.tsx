"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { defaultBasketballRules } from "./index";

export function BasketballRulesFields({
  value,
  onChange,
  disabled = false,
}: {
  value: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("BasketballRules");
  const prefix = useId();
  const fields = [
    { key: "foulOut", min: 1, max: 10 },
    { key: "teamBonusAfter", min: 0, max: 20 },
    { key: "quarters", min: 1, max: 8 },
    { key: "quarterMinutes", min: 1, max: 30 },
    { key: "overtimeMinutes", min: 1, max: 15 },
  ] as const;
  const timeouts =
    value.timeouts && typeof value.timeouts === "object"
      ? (value.timeouts as Record<string, unknown>)
      : {};
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">{t("title")}</legend>
      {fields.map(({ key, min, max }) => (
        <div key={key} className="space-y-2">
          <label htmlFor={`${prefix}-${key}`} className="text-sm font-semibold">
            {t(key)}
          </label>
          <Input
            id={`${prefix}-${key}`}
            type="number"
            min={min}
            max={max}
            step={1}
            value={
              typeof value[key] === "number"
                ? (value[key] as number)
                : defaultBasketballRules[key]
            }
            onChange={(event) =>
              onChange?.({ ...value, [key]: Number(event.target.value) })
            }
          />
        </div>
      ))}
      {(["firstHalf", "secondHalf", "overtime"] as const).map((key) => (
        <div key={key} className="space-y-2">
          <label htmlFor={`${prefix}-${key}`} className="text-sm font-semibold">
            {t(key)}
          </label>
          <Input
            id={`${prefix}-${key}`}
            type="number"
            min={0}
            max={10}
            step={1}
            value={
              typeof timeouts[key] === "number"
                ? (timeouts[key] as number)
                : defaultBasketballRules.timeouts[key]
            }
            onChange={(event) =>
              onChange?.({
                ...value,
                timeouts: { ...timeouts, [key]: Number(event.target.value) },
              })
            }
          />
        </div>
      ))}
    </fieldset>
  );
}
