"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { createScorerPin } from "@/app/(admin)/admin/[league]/schedule/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

/**
 * The two ways to score a game, always in view: open the scorebook on this
 * device, or make a PIN (with a QR code) for the scorer's device.
 */
export function ScorerAccess({
  slug,
  gameId,
  siteUrl,
  dark = false,
}: {
  slug: string;
  gameId: string;
  siteUrl: string;
  /** On a navy live-game card. */
  dark?: boolean;
}) {
  const t = useTranslations("Scorer");
  const mutation = useScheduleMutation();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState<string>();
  const [qr, setQr] = useState<string>();
  const link = `${siteUrl}/score/${gameId}`;
  function makePin() {
    mutation.run(
      () => createScorerPin(slug, gameId),
      async (result) => {
        if (!result.pin) return;
        setPin(result.pin);
        setQr(
          await QRCode.toDataURL(`${link}#pin=${result.pin}`, {
            margin: 1,
            width: 384,
          }),
        );
      },
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="min-h-12 px-3">
          <Link href={`/score/${gameId}`}>
            <Icon name="games" className="size-5" />
            {t("openScorebook")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          className={cn(
            "min-h-12 px-3",
            dark &&
              "border-white/40 bg-transparent text-on-dark hover:bg-white/10",
          )}
          onClick={() => {
            setOpen(!open);
            if (!open && !pin) makePin();
          }}
        >
          <Icon name="pin" className="size-5" />
          {t("scorerAccess")}
        </Button>
      </div>
      {/* Opens in a new tab, for the laptop or TV at the gym. */}
      <a
        href={`/tv/${gameId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:underline",
          dark ? "text-orange-soft" : "text-orange-dark",
        )}
      >
        <Icon name="live" className="size-4" />
        {t("openTv")}
      </a>
      {open && (
        <div
          className={cn(
            "space-y-4 rounded-xl border p-4",
            dark ? "border-white/15 bg-white/5" : "bg-background",
          )}
        >
          <p
            className={cn(
              "text-sm",
              dark ? "text-on-dark-muted" : "text-muted-foreground",
            )}
          >
            {t("scorerAccessHelp")}
          </p>
          {mutation.pending && !pin && (
            <p className="text-sm font-semibold">{t("makingPin")}</p>
          )}
          {pin && (
            <div className="flex flex-wrap items-center gap-4">
              {qr && (
                // A data URL generated on this device; next/image adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt={t("qrAlt")}
                  width={144}
                  height={144}
                  className="rounded-xl border bg-white p-2"
                />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold">{t("pinLabel")}</p>
                <p
                  className="font-display text-5xl font-semibold tracking-[0.25em]"
                  aria-live="polite"
                >
                  {pin}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    dark ? "text-on-dark-muted" : "text-muted-foreground",
                  )}
                >
                  {t("pinExpires")}
                </p>
              </div>
            </div>
          )}
          {pin && (
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="outline"
                className="min-h-11 py-2 text-foreground"
              >
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(t("shareScorerText", { link }))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("shareLink")}
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 py-2"
                disabled={mutation.pending}
                onClick={makePin}
              >
                {t("newPin")}
              </Button>
            </div>
          )}
          {mutation.result?.error && (
            <ScheduleFeedback
              result={mutation.result}
              message={(key) => t(key)}
            />
          )}
        </div>
      )}
    </div>
  );
}
