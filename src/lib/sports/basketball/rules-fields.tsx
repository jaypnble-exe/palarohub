"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const shotClock = {
    ...defaultBasketballRules.shotClock,
    ...(value.shotClock && typeof value.shotClock === "object"
      ? (value.shotClock as Record<string, unknown>)
      : {}),
  } as typeof defaultBasketballRules.shotClock;
  const setShotClock = (next: Partial<typeof shotClock>) =>
    onChange?.({ ...value, shotClock: { ...shotClock, ...next } });
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
      <div className="space-y-4 rounded-xl border bg-background p-4 sm:col-span-2">
        <Switch
          label={t("shotClock")}
          description={t("shotClockHelp")}
          checked={shotClock.enabled}
          disabled={disabled}
          onChange={(enabled) => setShotClock({ enabled })}
        />
        {shotClock.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["seconds", 10, 35],
                ["resetSeconds", 1, 35],
              ] as const
            ).map(([key, min, max]) => (
              <div key={key} className="space-y-2">
                <label
                  htmlFor={`${prefix}-${key}`}
                  className="text-sm font-semibold"
                >
                  {t(key === "seconds" ? "shotClockSeconds" : "shotClockReset")}
                </label>
                <Input
                  id={`${prefix}-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  step={1}
                  value={shotClock[key]}
                  onChange={(event) =>
                    setShotClock({ [key]: Number(event.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
