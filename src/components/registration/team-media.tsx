"use client";
import Image from "next/image";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  MAX_TEAM_IMAGE_BYTES,
  type RegistrationMediaAssets,
  type TeamMediaAsset,
  type TeamMediaKind,
} from "@/lib/validation/team-media";

export function RegistrationMediaPreview({
  assets,
}: {
  assets: RegistrationMediaAssets;
}) {
  const t = useTranslations("Registration");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["logo", "jersey"] as const).map((kind) => {
        const asset = assets[kind];
        return (
          asset && (
            <figure
              key={kind}
              className="space-y-2 rounded-2xl border bg-card p-4"
            >
              <figcaption className="font-semibold">
                {t(kind === "logo" ? "teamLogo" : "jerseyDesign")}
              </figcaption>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("openTeamImage", {
                  image: t(kind === "logo" ? "teamLogo" : "jerseyDesign"),
                })}
              >
                <Image
                  unoptimized
                  src={asset.url}
                  alt={t(kind === "logo" ? "teamLogo" : "jerseyDesign")}
                  width={400}
                  height={300}
                  className="h-48 w-full rounded-xl bg-muted object-contain"
                />
              </a>
            </figure>
          )
        );
      })}
    </div>
  );
}

export function TeamMediaUpload({
  slug,
  teamId,
  kind,
  asset,
  disabled,
  onChange,
  onBusy,
}: {
  slug: string;
  teamId: string;
  kind: TeamMediaKind;
  asset?: TeamMediaAsset;
  disabled: boolean;
  onChange: (asset: TeamMediaAsset | undefined) => void;
  onBusy: (busy: boolean) => void;
}) {
  const t = useTranslations("Registration");
  const id = useId();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const label = t(kind === "logo" ? "teamLogoUpload" : "jerseyDesignOptional");
  async function upload(file: File) {
    setError(undefined);
    if (file.size > MAX_TEAM_IMAGE_BYTES) {
      setError("imageTooLarge");
      return;
    }
    if (
      !file.size ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("invalidImage");
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      const form = new FormData();
      form.set("teamId", teamId);
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch(
        `/api/team-media/${encodeURIComponent(slug)}`,
        { method: "POST", body: form },
      );
      const body = await response.json();
      if (
        !response.ok ||
        typeof body.path !== "string" ||
        typeof body.url !== "string"
      ) {
        setError(
          ["invalidImage", "imageTooLarge", "notAllowed"].includes(body.error)
            ? body.error
            : "uploadFailed",
        );
        return;
      }
      onChange({ path: body.path, url: body.url });
    } catch {
      setError("uploadFailed");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {t("teamImageHelp")}
      </p>
      {asset && (
        <Image
          unoptimized
          src={asset.url}
          alt={label}
          width={320}
          height={240}
          className="h-40 w-full rounded-xl bg-muted object-contain"
        />
      )}
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-describedby={`${id}-help`}
        aria-required={kind === "logo"}
        disabled={disabled || busy}
        className="block min-h-12 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:bg-background file:px-3 file:font-semibold"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void upload(file);
        }}
      />
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("uploadingImage")}
        </p>
      )}
      {kind === "jersey" && asset && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => onChange(undefined)}
        >
          {t("removeJerseyDesign")}
        </Button>
      )}
      {error && <Alert tone="danger">{t(error)}</Alert>}
    </div>
  );
}
