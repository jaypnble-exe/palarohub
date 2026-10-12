"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTeam, createPlayer } from "@/app/(team)/team/[league]/actions";
import {
  teamSchema,
  type RegistrationActionResult,
} from "@/lib/validation/registration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegistrationFeedback } from "./feedback";

export function NameForm({
  slug,
  kind,
  embedded = false,
  onCreated,
}: {
  slug: string;
  kind: "team" | "player";
  embedded?: boolean;
  onCreated?: (id: string) => void;
}) {
  const t = useTranslations("Registration");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationActionResult>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string }>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "" },
  });
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={handleSubmit((input) =>
        startTransition(async () => {
          try {
            const next = await (kind === "team" ? createTeam : createPlayer)(
              slug,
              input,
            );
            setResult(next);
            if (next.success) {
              reset();
              router.refresh();
              if (next.id) onCreated?.(next.id);
            }
          } catch {
            setResult({ error: "saveFailed" });
          }
        }),
      )}
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor={`${kind}-name`} className="font-semibold">
          {t(kind === "team" ? "teamName" : "playerName")}
        </label>
        <Input
          id={`${kind}-name`}
          {...register("name")}
          disabled={pending}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{t("invalidName")}</p>
        )}
      </div>
      {kind === "player" && (
        <p className="text-sm text-muted-foreground">{t("newPlayerHelp")}</p>
      )}
      <Button disabled={pending} variant={embedded ? "outline" : "default"}>
        {t(pending ? "saving" : kind === "team" ? "createTeam" : "addPlayer")}
      </Button>
      <RegistrationFeedback
        result={result}
        successKey={kind === "player" ? "playerCreated" : "teamCreated"}
      />
    </form>
  );
}
